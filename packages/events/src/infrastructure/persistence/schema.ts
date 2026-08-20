/**
 * Tenant-DB-side schema, applied via applyEventsMigrations. Unlike a
 * business module's schema (owned by that module's manifest), this table
 * needs to exist before ANY module might want to publish an event — see
 * apply-migrations.ts's doc comment for why modules/core's own migration
 * step is what actually runs this one.
 *
 * No tenant_id column: this lives inside the tenant's own database
 * already (database-per-tenant), so every row here is implicitly scoped.
 */
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  aggregateId: text("aggregate_id").notNull(),
  eventType: text("event_type").notNull(),
  version: integer("version").notNull().default(1),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Set once every consumer registered at the time succeeded — see publish-pending-events.ts.
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
});

/** Per-(event, consumer) delivery record — the actual idempotent-dedup ledger CLAUDE.md §25 requires. */
export const processedEvents = pgTable(
  "processed_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => outbox.id),
    consumerId: text("consumer_id").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("processed_events_event_consumer_idx").on(table.eventId, table.consumerId)],
);
