import type { TenantDb } from "@erp/database";
import type { Warehouse } from "../domain/warehouse";

export interface WarehouseRepository {
  create(db: TenantDb, input: { name: string; isDefault: boolean }): Promise<Warehouse>;
  findById(db: TenantDb, id: string): Promise<Warehouse | undefined>;
  findDefault(db: TenantDb): Promise<Warehouse | undefined>;
  /** Idempotent: creates the "Main Warehouse" default only if none exists yet, race-safe via a unique constraint on `name`. */
  createDefaultIfMissing(db: TenantDb): Promise<Warehouse>;
  list(db: TenantDb): Promise<Warehouse[]>;
}
