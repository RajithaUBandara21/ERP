/**
 * A read-optimized aggregate, not a transactional record — owned entirely
 * by `reporting`, built by consuming `pos`'s OrderPaid events (EVENTS.md
 * §6), never by querying pos's own tables (CLAUDE.md §10, §52). One row
 * per calendar date (UTC), incrementally updated as events arrive.
 */
export interface SalesDailySummary {
  date: string; // YYYY-MM-DD (UTC)
  transactionCount: number;
  totalCents: number;
  updatedAt: Date;
}
