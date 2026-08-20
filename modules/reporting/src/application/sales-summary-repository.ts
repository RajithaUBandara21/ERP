import type { TenantDb } from "@erp/database";
import type { SalesDailySummary } from "../domain/sales-daily-summary";

export interface SalesSummaryPage {
  items: SalesDailySummary[];
  /** Present only when there are more rows beyond this page — pass it back as the next call's cursor. */
  nextCursor?: string;
}

export interface SalesSummaryRepository {
  /**
   * Atomically adds to the row for `date` (creating it if absent) —
   * never a read-then-write, so concurrent/retried increments (e.g. a
   * redelivered event that slipped past the publisher's own dedup) can't
   * race each other into a lost update. `deltaTransactionCount` and
   * `deltaTotalCents` are usually +1/+amount, but signed so a future
   * "OrderRefunded" consumer could subtract from the same row.
   */
  incrementForDate(db: TenantDb, date: string, deltaTransactionCount: number, deltaTotalCents: number): Promise<void>;

  /** Cursor-paginated, most recent date first — CLAUDE.md §30/§52: never an unbounded scan. */
  list(db: TenantDb, cursor: string | undefined, limit: number): Promise<SalesSummaryPage>;
}
