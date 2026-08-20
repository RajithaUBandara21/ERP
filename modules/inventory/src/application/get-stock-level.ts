import type { TenantDb } from "@erp/database";
import type { StockLevel } from "../domain/stock-level";
import type { StockRepository } from "./stock-repository";
import type { WarehouseRepository } from "./warehouse-repository";
import { getOrCreateDefaultWarehouse } from "./get-or-create-default-warehouse";

export interface GetStockLevelDependencies {
  stockRepository: StockRepository;
  warehouseRepository: WarehouseRepository;
}

export async function getStockLevel(
  dependencies: GetStockLevelDependencies,
  db: TenantDb,
  input: { sku: string; warehouseId?: string },
): Promise<StockLevel> {
  const warehouse = input.warehouseId
    ? { id: input.warehouseId }
    : await getOrCreateDefaultWarehouse(dependencies.warehouseRepository, db);

  const level = await dependencies.stockRepository.getLevel(db, warehouse.id, input.sku);
  return level ?? { warehouseId: warehouse.id, sku: input.sku, onHand: 0, reserved: 0, available: 0 };
}
