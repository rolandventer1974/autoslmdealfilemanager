import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const docTypesTable = pgTable("doc_types", {
  id: serial("id").primaryKey(),
  dealerCode: text("dealer_code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDocTypeSchema = createInsertSchema(docTypesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocType = z.infer<typeof insertDocTypeSchema>;
export type DocType = typeof docTypesTable.$inferSelect;
