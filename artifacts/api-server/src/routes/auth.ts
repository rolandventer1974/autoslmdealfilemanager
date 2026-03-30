import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import crypto from "crypto";
import {
  checkAutoSLMLogin,
  AutoSLMAuthError,
} from "../lib/autoslmAuth.js";

const router: IRouter = Router();

const SESSION_TTL_DAYS = 30;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function sessionExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d;
}

async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = sessionExpiry();
  await db.insert(sessionsTable).values({ token, userId, expiresAt });
  return token;
}

async function resolveSession(token: string): Promise<number | null> {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.token, token),
        gt(sessionsTable.expiresAt, new Date()),
      ),
    );
  return session?.userId ?? null;
}

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    dealerCode: user.dealerCode,
    levelId: user.levelId,
    rid: user.rid,
    retailerName: user.retailerName,
    mobile: user.mobile,
    mobileLogo: user.mobileLogo,
    createdAt: user.createdAt,
  };
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  try {
    const profile = await checkAutoSLMLogin(username, password);

    const dealerCode = profile.rid || profile.userId;

    const [upserted] = await db
      .insert(usersTable)
      .values({
        username,
        passwordHash: "",
        name: profile.displayName || username,
        email: profile.email || null,
        role: profile.role || "sales",
        dealerCode,
        levelId: profile.levelId || null,
        rid: profile.rid || null,
        retailerName: profile.retailerName || null,
        mobile: profile.mobile || null,
        mobileLogo: profile.mobileLogo || null,
        dealerGroups: profile.dealerGroups || null,
        retailerOptions: profile.retailerOptions || null,
      })
      .onConflictDoUpdate({
        target: usersTable.username,
        set: {
          name: profile.displayName || username,
          email: profile.email || null,
          role: profile.role || "sales",
          dealerCode,
          levelId: profile.levelId || null,
          rid: profile.rid || null,
          retailerName: profile.retailerName || null,
          mobile: profile.mobile || null,
          mobileLogo: profile.mobileLogo || null,
          dealerGroups: profile.dealerGroups || null,
          retailerOptions: profile.retailerOptions || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    const token = await createSession(upserted.id);
    res.json({ user: formatUser(upserted), token });
  } catch (err: unknown) {
    if (err instanceof AutoSLMAuthError) {
      if (err.isCredentialError) {
        res.status(401).json({ error: "Invalid username or password" });
      } else {
        res
          .status(503)
          .json({ error: `Authentication service unavailable: ${err.message}` });
      }
    } else {
      const msg = err instanceof Error ? err.message : "Login failed";
      res.status(500).json({ error: msg });
    }
  }
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const token = authHeader.slice(7);
  const userId = await resolveSession(token);
  if (!userId) {
    res.status(401).json({ error: "Session expired or invalid" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(user));
});

export default router;
