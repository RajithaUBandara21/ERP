/**
 * Tenant-DB-side schema — same pattern as modules/pos's and
 * modules/inventory's (see their schema.ts doc comments). Applied via
 * applyPaymentsMigrations (src/index.ts).
 */
import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // e.g. a POS transaction/cart id — the thing being paid for, owned by another module (CLAUDE.md §33: payments never owns order/cart state).
    reference: text("reference").notNull(),
    method: text("method").notNull(),
    provider: text("provider").notNull(),
    amountCents: integer("amount_cents").notNull(),
    capturedAmountCents: integer("captured_amount_cents").notNull(),
    refundedAmountCents: integer("refunded_amount_cents").notNull().default(0),
    providerTransactionId: text("provider_transaction_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    // PaymentAttemptStatus — see domain/payment-attempt.ts
    status: text("status").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("payment_attempts_idempotency_key_idx").on(table.idempotencyKey)],
);

export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentAttemptId: uuid("payment_attempt_id")
    .notNull()
    .references(() => paymentAttempts.id),
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason"),
  providerRefundId: text("provider_refund_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
