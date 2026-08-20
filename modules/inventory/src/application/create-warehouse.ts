import type { TenantDb } from "@erp/database";
import type { Warehouse } from "../domain/warehouse";
import type { WarehouseRepository } from "./warehouse-repository";

export interface CreateWarehouseInput {
  name: string;
  isDefault?: boolean;
}

export async function createWarehouse(
  repository: WarehouseRepository,
  db: TenantDb,
  input: CreateWarehouseInput,
): Promise<Warehouse> {
  return repository.create(db, { name: input.name, isDefault: input.isDefault ?? false });
}
