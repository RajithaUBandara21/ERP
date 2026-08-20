/**
 * Tenant-DB-side schema — same pattern as modules/pos's (see its schema.ts
 * doc comment). Applied via applyDeliveryMigrations (src/index.ts).
 */
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // 'active' | 'inactive'
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Opaque order reference — no FK, see domain/delivery.ts's doc comment.
  orderReference: text("order_reference").notNull(),
  // DeliveryStatus — see domain/delivery.ts
  status: text("status").notNull().default("pending"),
  driverId: uuid("driver_id").references(() => drivers.id),
  ...timestamps,
});

export const deliveryAssignments = pgTable("delivery_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  deliveryId: uuid("delivery_id")
    .notNull()
    .references(() => deliveries.id),
  driverId: uuid("driver_id")
    .notNull()
    .references(() => drivers.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
});
