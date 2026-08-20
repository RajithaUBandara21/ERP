import type { TenantDb } from "@erp/database";
import type { StockLevel } from "../domain/stock-level";
import type { StockRepository } from "./stock-repository";
import type { WarehouseRepository } from "./warehouse-repository";
import { getOrCreateDefaultWarehouse } from "./get-or-create-default-warehouse";

export interface AdjustStockDependencies {
  stockRepository: StockRepository;
  warehouseRepository: WarehouseRepository;
}

export interface AdjustStockInput {
  sku: string;
  /** Signed correction — negative to write down, positive to write up. Zero is rejected (not a real adjustment). */
  delta: number;
  warehouseId?: string;
  reference?: string;
}

export async function adjustStock(
  dependencies: AdjustStockDependencies,
  db: TenantDb,
  input: AdjustStockInput,
): Promise<StockLevel> {
  if (input.delta === 0) throw new RangeError("delta must be non-zero");

  const warehouse = input.warehouseId
    ? { id: input.warehouseId }
    : await getOrCreateDefaultWarehouse(dependencies.warehouseRepository, db);

  return dependencies.stockRepository.applyMovement(db, {
    warehouseId: warehouse.id,
    sku: input.sku,
    type: "ADJUSTMENT",
    onHandDelta: input.delta,
    reservedDelta: 0,
    ...(input.reference !== undefined ? { reference: input.reference } : {}),
  });
}
