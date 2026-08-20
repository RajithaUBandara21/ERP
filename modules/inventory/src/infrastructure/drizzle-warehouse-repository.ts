import type { TenantDb } from "@erp/database";
import { eq } from "drizzle-orm";
import type { Warehouse } from "../domain/warehouse";
import type { WarehouseRepository } from "../application/warehouse-repository";
import { warehouses } from "./persistence/schema";

const DEFAULT_WAREHOUSE_NAME = "Main Warehouse";

function toDomain(row: typeof warehouses.$inferSelect): Warehouse {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Known simplification: `isDefault` has no database-level uniqueness
 * constraint, so a caller explicitly creating a second warehouse with
 * isDefault: true would make findDefault()'s result ambiguous. The only
 * caller that sets isDefault today is createDefaultIfMissing, which is
 * itself race-safe via the unique constraint on `name` — not a gap in the
 * primary path, just an unenforced edge case in the general API.
 */
export class DrizzleWarehouseRepository implements WarehouseRepository {
  async create(db: TenantDb, input: { name: string; isDefault: boolean }): Promise<Warehouse> {
    const [row] = await db.insert(warehouses).values(input).returning();
    if (!row) throw new Error("Failed to create warehouse");
    return toDomain(row);
  }

  async findById(db: TenantDb, id: string): Promise<Warehouse | undefined> {
    const [row] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);
    return row ? toDomain(row) : undefined;
  }

  async findDefault(db: TenantDb): Promise<Warehouse | undefined> {
    const [row] = await db.select().from(warehouses).where(eq(warehouses.isDefault, true)).limit(1);
    return row ? toDomain(row) : undefined;
  }

  async createDefaultIfMissing(db: TenantDb): Promise<Warehouse> {
    await db
      .insert(warehouses)
      .values({ name: DEFAULT_WAREHOUSE_NAME, isDefault: true })
      .onConflictDoNothing({ target: warehouses.name });

    const [row] = await db.select().from(warehouses).where(eq(warehouses.name, DEFAULT_WAREHOUSE_NAME)).limit(1);
    if (!row) throw new Error("Failed to resolve default warehouse");
    return toDomain(row);
  }

  async list(db: TenantDb): Promise<Warehouse[]> {
    const rows = await db.select().from(warehouses);
    return rows.map(toDomain);
  }
}
