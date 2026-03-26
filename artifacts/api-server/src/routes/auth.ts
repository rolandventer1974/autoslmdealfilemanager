import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "autoslm_salt_2024").digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const sessions = new Map<string, number>();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user) {
    const hash = hashPassword(password);
    const [newUser] = await db.insert(usersTable).values({
      username,
      passwordHash: hash,
      name: username,
      role: "admin",
      dealerCode: parsed.data.dealerCode || "0000",
    }).returning();
    const token = generateToken();
    sessions.set(token, newUser.id);
    res.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        dealerCode: newUser.dealerCode,
        createdAt: newUser.createdAt,
      },
      token,
    });
    return;
  }

  const hash = hashPassword(password);
  if (user.passwordHash !== hash) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = generateToken();
  sessions.set(token, user.id);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      dealerCode: user.dealerCode,
      createdAt: user.createdAt,
    },
    token,
  });
});

router.post("/auth/logout", (req, res): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    sessions.delete(token);
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
  const userId = sessions.get(token);
  if (!userId) {
    res.status(401).json({ error: "Session expired or invalid" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    dealerCode: user.dealerCode,
    createdAt: user.createdAt,
  });
});

export { sessions };
export default router;
