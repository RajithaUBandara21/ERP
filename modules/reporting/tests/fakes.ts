import type { TenantDb } from "@erp/database";
import type { SalesDailySummary } from "../src/domain/sales-daily-summary";
import type { SalesSummaryPage, SalesSummaryRepository } from "../src/application/sales-summary-repository";

export const fakeDb = {} as TenantDb;

export class FakeSalesSummaryRepository implements SalesSummaryRepository {
  private readonly byDate = new Map<string, SalesDailySummary>();

  async incrementForDate(_db: TenantDb, date: string, deltaTransactionCount: number, deltaTotalCents: number): Promise<void> {
    const existing = this.byDate.get(date);
    this.byDate.set(date, {
      date,
      transactionCount: (existing?.transactionCount ?? 0) + deltaTransactionCount,
      totalCents: (existing?.totalCents ?? 0) + deltaTotalCents,
      updatedAt: new Date(),
    });
  }

  async list(_db: TenantDb, cursor: string | undefined, limit: number): Promise<SalesSummaryPage> {
    const sorted = [...this.byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
    const afterCursor = cursor ? sorted.filter((row) => row.date < cursor) : sorted;
    const hasMore = afterCursor.length > limit;
    const page = hasMore ? afterCursor.slice(0, limit) : afterCursor;
    const nextCursor = hasMore ? page[page.length - 1]?.date : undefined;
    return { items: page, ...(nextCursor !== undefined ? { nextCursor } : {}) };
  }
}
