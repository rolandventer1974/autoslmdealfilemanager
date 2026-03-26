import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dealFilesTable } from "./dealFiles";
import { docTypesTable } from "./docTypes";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  dealFileId: integer("deal_file_id").notNull().references(() => dealFilesTable.id, { onDelete: "cascade" }),
  docTypeId: integer("doc_type_id").references(() => docTypesTable.id, { onDelete: "set null" }),
  docTypeName: text("doc_type_name").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  source: text("source").notNull().default("upload"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, uploadedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
