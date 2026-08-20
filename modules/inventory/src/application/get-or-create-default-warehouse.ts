import type { TenantDb } from "@erp/database";
import type { Warehouse } from "../domain/warehouse";
import type { WarehouseRepository } from "./warehouse-repository";

/**
 * Lets stock operations work without requiring a tenant admin to have set
 * up warehouses first — POS terminals don't carry a warehouseId yet
 * (branch/warehouse scoping was deferred in Phase 5, see ADR-0007's
 * Update). Race-safe: two concurrent first-time callers both attempt the
 * same `createDefaultIfMissing`, which relies on a database unique
 * constraint, not an application-level check-then-act.
 */
export async function getOrCreateDefaultWarehouse(repository: WarehouseRepository, db: TenantDb): Promise<Warehouse> {
  const existing = await repository.findDefault(db);
  if (existing) return existing;
  return repository.createDefaultIfMissing(db);
}
