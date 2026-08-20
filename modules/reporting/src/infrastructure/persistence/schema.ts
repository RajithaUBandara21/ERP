/**
 * Tenant-DB-side schema — same pattern as modules/pos's (see its schema.ts
 * doc comment). Applied via applyReportingMigrations (src/index.ts). This
 * is a read model, not an operational table: nothing outside this module
 * writes to it except createOrderPaidReportConsumer.
 */
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const salesDailySummary = pgTable("sales_daily_summary", {
  // YYYY-MM-DD (UTC) — one row per day, the natural primary key for this aggregate.
  date: text("date").primaryKey(),
  transactionCount: integer("transaction_count").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
