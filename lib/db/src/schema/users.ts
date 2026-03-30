import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull().default(""),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("sales"),
  dealerCode: text("dealer_code").notNull(),
  levelId: text("level_id"),
  levelName: text("level_name"),
  rid: text("rid"),
  retailerName: text("retailer_name"),
  mobile: text("mobile"),
  mobileLogo: text("mobile_logo"),
  dealerGroups: text("dealer_groups"),
  retailerOptions: text("retailer_options"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
