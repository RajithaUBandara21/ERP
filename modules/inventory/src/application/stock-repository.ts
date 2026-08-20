import type { TenantDb } from "@erp/database";
import type { StockLevel } from "../domain/stock-level";
import type { StockMovementType } from "../domain/stock-movement";

export interface ApplyMovementInput {
  warehouseId: string;
  sku: string;
  type: StockMovementType;
  /** Signed delta applied to onHand. Zero for movements that only touch reservations (RESERVATION, RELEASE). */
  onHandDelta: number;
  /** Signed delta applied to reserved. Zero for movements that don't touch reservations (RECEIPT, RETURN, ADJUSTMENT, DAMAGE). */
  reservedDelta: number;
  reference?: string;
}

export interface StockRepository {
  getLevel(db: TenantDb, warehouseId: string, sku: string): Promise<StockLevel | undefined>;
  /**
   * Applies one ledger entry and its projection update in a single
   * database transaction, row-locking the stock_levels row first — see
   * infrastructure/drizzle-stock-repository.ts. Throws
   * InsufficientStockError if the result would be physically impossible
   * (negative onHand/reserved, or reserved > onHand).
   */
  applyMovement(db: TenantDb, input: ApplyMovementInput): Promise<StockLevel>;
}
