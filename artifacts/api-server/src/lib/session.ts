import type { Request } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable } from "@workspace/db";

export type SessionUser = typeof usersTable.$inferSelect;

export async function resolveCurrentUser(req: Request): Promise<SessionUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, new Date())));

  if (!session) return null;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId));

  return user ?? null;
}

const MANAGER_ROLE_KEYWORDS = [
  "manager",
  "principal",
  "admin",
  "dp",
  " gm",
  "general manager",
  "director",
  "owner",
];

export function isManagerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return MANAGER_ROLE_KEYWORDS.some((kw) => lower.includes(kw));
}
