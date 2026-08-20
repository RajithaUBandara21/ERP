import type { TenantDb } from "@erp/database";
import type { StockLevel } from "../domain/stock-level";
import type { StockRepository } from "./stock-repository";
import type { WarehouseRepository } from "./warehouse-repository";
import { getOrCreateDefaultWarehouse } from "./get-or-create-default-warehouse";

export interface ReceiveStockDependencies {
  stockRepository: StockRepository;
  warehouseRepository: WarehouseRepository;
}

export interface ReceiveStockInput {
  sku: string;
  quantity: number;
  warehouseId?: string;
  reference?: string;
}

export async function receiveStock(
  dependencies: ReceiveStockDependencies,
  db: TenantDb,
  input: ReceiveStockInput,
): Promise<StockLevel> {
  if (input.quantity <= 0) throw new RangeError("quantity must be positive");

  const warehouse = input.warehouseId
    ? { id: input.warehouseId }
    : await getOrCreateDefaultWarehouse(dependencies.warehouseRepository, db);

  return dependencies.stockRepository.applyMovement(db, {
    warehouseId: warehouse.id,
    sku: input.sku,
    type: "RECEIPT",
    onHandDelta: input.quantity,
    reservedDelta: 0,
    ...(input.reference !== undefined ? { reference: input.reference } : {}),
  });
}
