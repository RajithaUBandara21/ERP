import type { TenantDb } from "@erp/database";
import type { StockRepository } from "./stock-repository";
import type { WarehouseRepository } from "./warehouse-repository";
import { getOrCreateDefaultWarehouse } from "./get-or-create-default-warehouse";
import type { StockLine } from "./reserve-stock";

export interface ReleaseReservationDependencies {
  stockRepository: StockRepository;
  warehouseRepository: WarehouseRepository;
}

export interface ReleaseReservationInput {
  lines: StockLine[];
  warehouseId?: string;
  reference?: string;
}

/** Undoes a prior reserveStock() — the compensating action when a reservation is no longer needed (e.g. payment failed). */
export async function releaseReservation(
  dependencies: ReleaseReservationDependencies,
  db: TenantDb,
  input: ReleaseReservationInput,
): Promise<void> {
  const warehouse = input.warehouseId
    ? { id: input.warehouseId }
    : await getOrCreateDefaultWarehouse(dependencies.warehouseRepository, db);

  for (const line of input.lines) {
    await dependencies.stockRepository.applyMovement(db, {
      warehouseId: warehouse.id,
      sku: line.sku,
      type: "RELEASE",
      onHandDelta: 0,
      reservedDelta: -line.quantity,
      ...(input.reference !== undefined ? { reference: input.reference } : {}),
    });
  }
}
