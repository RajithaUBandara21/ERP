/**
 * A transactionally-consistent projection of the stock_movements ledger,
 * not an independently-mutated counter (CLAUDE.md §21) — every write to
 * this row happens in the same database transaction as the ledger entry
 * that explains it (see infrastructure/drizzle-stock-repository.ts).
 */
export interface StockLevel {
  warehouseId: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
}

export function toStockLevel(row: { warehouseId: string; sku: string; onHand: number; reserved: number }): StockLevel {
  return { ...row, available: row.onHand - row.reserved };
}
