import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealFilesTable = pgTable("deal_files", {
  id: serial("id").primaryKey(),
  dealerCode: text("dealer_code").notNull(),
  customerName: text("customer_name").notNull(),
  idNumber: text("id_number"),
  email: text("email"),
  mobileNumber: text("mobile_number"),
  vehicleYear: text("vehicle_year"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleSpec: text("vehicle_spec"),
  vinNumber: text("vin_number"),
  salesExecutive: text("sales_executive"),
  salesManager: text("sales_manager"),
  financeCompany: text("finance_company"),
  dealNumber: text("deal_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDealFileSchema = createInsertSchema(dealFilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDealFile = z.infer<typeof insertDealFileSchema>;
export type DealFile = typeof dealFilesTable.$inferSelect;
