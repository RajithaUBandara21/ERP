import type { TenantDb } from "@erp/database";
import type { StockRepository } from "./stock-repository";
import type { WarehouseRepository } from "./warehouse-repository";
import { getOrCreateDefaultWarehouse } from "./get-or-create-default-warehouse";

export interface StockLine {
  sku: string;
  quantity: number;
}

export interface ReserveStockDependencies {
  stockRepository: StockRepository;
  warehouseRepository: WarehouseRepository;
}

export interface ReserveStockInput {
  lines: StockLine[];
  warehouseId?: string;
  reference?: string;
}

/**
 * Reserves each line's quantity (increments `reserved`, leaves `onHand`
 * untouched — see stock-repository.ts's ApplyMovementInput doc comment).
 * Each line is its own row-locked transaction (see
 * infrastructure/drizzle-stock-repository.ts), not one transaction across
 * every SKU in the request — the tradeoff is that a failure partway
 * through a multi-line reservation does not roll back at the database
 * level. To keep the overall call effectively all-or-nothing anyway, on
 * any failure this releases every line successfully reserved so far
 * before rethrowing (a compensating action per CLAUDE.md §22, not a true
 * atomic transaction — documented rather than silently assumed).
 */
export async function reserveStock(
  dependencies: ReserveStockDependencies,
  db: TenantDb,
  input: ReserveStockInput,
): Promise<void> {
  const warehouse = input.warehouseId
    ? { id: input.warehouseId }
    : await getOrCreateDefaultWarehouse(dependencies.warehouseRepository, db);

  const reserved: StockLine[] = [];
  try {
    for (const line of input.lines) {
      await dependencies.stockRepository.applyMovement(db, {
        warehouseId: warehouse.id,
        sku: line.sku,
        type: "RESERVATION",
        onHandDelta: 0,
        reservedDelta: line.quantity,
        ...(input.reference !== undefined ? { reference: input.reference } : {}),
      });
      reserved.push(line);
    }
  } catch (error) {
    for (const line of reserved) {
      await dependencies.stockRepository
        .applyMovement(db, {
          warehouseId: warehouse.id,
          sku: line.sku,
          type: "RELEASE",
          onHandDelta: 0,
          reservedDelta: -line.quantity,
          ...(input.reference !== undefined ? { reference: input.reference } : {}),
        })
        // Best-effort compensation — a release failure must not mask the original reservation error.
        .catch(() => undefined);
    }
    throw error;
  }
}
