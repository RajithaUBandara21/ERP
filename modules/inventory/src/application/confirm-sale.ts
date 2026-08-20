import type { TenantDb } from "@erp/database";
import type { StockRepository } from "./stock-repository";
import type { WarehouseRepository } from "./warehouse-repository";
import { getOrCreateDefaultWarehouse } from "./get-or-create-default-warehouse";
import type { StockLine } from "./reserve-stock";

export interface ConfirmSaleDependencies {
  stockRepository: StockRepository;
  warehouseRepository: WarehouseRepository;
}

export interface ConfirmSaleInput {
  lines: StockLine[];
  warehouseId?: string;
  reference?: string;
}

/** Finalizes a prior reserveStock() into an actual deduction once payment succeeds — decrements both `reserved` and `onHand`. */
export async function confirmSale(
  dependencies: ConfirmSaleDependencies,
  db: TenantDb,
  input: ConfirmSaleInput,
): Promise<void> {
  const warehouse = input.warehouseId
    ? { id: input.warehouseId }
    : await getOrCreateDefaultWarehouse(dependencies.warehouseRepository, db);

  for (const line of input.lines) {
    await dependencies.stockRepository.applyMovement(db, {
      warehouseId: warehouse.id,
      sku: line.sku,
      type: "SALE",
      onHandDelta: -line.quantity,
      reservedDelta: -line.quantity,
      ...(input.reference !== undefined ? { reference: input.reference } : {}),
    });
  }
}
