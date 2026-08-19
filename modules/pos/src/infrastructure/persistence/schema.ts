/**
 * Tenant-DB-side schema — same pattern as modules/identity's (see its
 * schema.ts doc comment). Applied via applyPosMigrations (src/index.ts).
 */
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { CartLine } from "../../domain/cart-line";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const terminals = pgTable("terminals", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  deviceId: text("device_id"),
  // 'active' | 'inactive'
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  terminalId: uuid("terminal_id").notNull().references(() => terminals.id),
  // No Customer entity/FK exists yet (sales module) — stored unvalidated.
  customerId: text("customer_id"),
  // 'open' | 'completed' | 'abandoned'
  status: text("status").notNull().default("open"),
  lines: jsonb("lines").$type<CartLine[]>().notNull().default([]),
  ...timestamps,
});

export const posTransactions = pgTable("pos_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  terminalId: uuid("terminal_id").notNull().references(() => terminals.id),
  cartId: uuid("cart_id").references(() => carts.id),
  customerId: text("customer_id"),
  lines: jsonb("lines").$type<CartLine[]>().notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  taxCents: integer("tax_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  paymentMethod: text("payment_method").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  // 'completed' | 'voided'
  status: text("status").notNull().default("completed"),
  ...timestamps,
}, (table) => [uniqueIndex("pos_transactions_idempotency_key_idx").on(table.idempotencyKey)]);
