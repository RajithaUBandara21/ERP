/**
 * Tenant-DB-side schema — same pattern as modules/pos's (see its schema.ts
 * doc comment). Applied via applyInventoryMigrations (src/index.ts).
 *
 * stock_levels is a projection, not the source of truth — every write to
 * it happens in the same transaction as the stock_movements row that
 * explains it (see drizzle-stock-repository.ts). warehouses.name is
 * unique so getOrCreateDefaultWarehouse can race-safely upsert the "Main
 * Warehouse" default via ON CONFLICT DO NOTHING.
 */
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("warehouses_name_idx").on(table.name)],
);

export const stockLevels = pgTable(
  "stock_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    sku: text("sku").notNull(),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("stock_levels_warehouse_sku_idx").on(table.warehouseId, table.sku)],
);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
  sku: text("sku").notNull(),
  // StockMovementType — see domain/stock-movement.ts
  type: text("type").notNull(),
  onHandDelta: integer("on_hand_delta").notNull(),
  reservedDelta: integer("reserved_delta").notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
