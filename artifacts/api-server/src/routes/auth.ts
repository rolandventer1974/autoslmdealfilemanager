import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

const SALT = process.env["SESSION_SALT"] ?? "autoslm_salt_2024";
const SESSION_TTL_DAYS = 30;

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + SALT).digest("hex");
}

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
    .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, new Date())));
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
  const hash = hashPassword(password);

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!existing) {
    const [newUser] = await db.insert(usersTable).values({
      username,
      passwordHash: hash,
      name: username,
      role: "admin",
      dealerCode: parsed.data.dealerCode || "0000",
    }).returning();
    const token = await createSession(newUser.id);
    res.json({ user: formatUser(newUser), token });
    return;
  }

  if (existing.passwordHash !== hash) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = await createSession(existing.id);
  res.json({ user: formatUser(existing), token });
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
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(user));
});

export default router;
