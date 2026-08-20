/**
 * CLAUDE.md §21's movement vocabulary. TRANSFER is declared but not
 * implemented this phase (no use case, no route) — same "declared, not
 * wired yet" precedent as modules/pos's ORDER_REFUND permission.
 */
export type StockMovementType = "RECEIPT" | "RETURN" | "ADJUSTMENT" | "DAMAGE" | "RESERVATION" | "RELEASE" | "SALE";

/**
 * An append-only ledger entry. `onHandDelta`/`reservedDelta` are the signed
 * changes this entry applied to the StockLevel projection at the time it
 * was recorded — see stock-level.ts's doc comment for why the ledger, not
 * the projection, is the source of truth.
 */
export interface StockMovement {
  id: string;
  warehouseId: string;
  sku: string;
  type: StockMovementType;
  onHandDelta: number;
  reservedDelta: number;
  reference: string | null;
  createdAt: Date;
}
