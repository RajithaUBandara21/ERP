import type { TenantDb } from "@erp/database";
import { desc, lt, sql } from "drizzle-orm";
import type { SalesDailySummary } from "../domain/sales-daily-summary";
import type { SalesSummaryPage, SalesSummaryRepository } from "../application/sales-summary-repository";
import { salesDailySummary } from "./persistence/schema";

function toDomain(row: typeof salesDailySummary.$inferSelect): SalesDailySummary {
  return { date: row.date, transactionCount: row.transactionCount, totalCents: row.totalCents, updatedAt: row.updatedAt };
}

export class DrizzleSalesSummaryRepository implements SalesSummaryRepository {
  async incrementForDate(db: TenantDb, date: string, deltaTransactionCount: number, deltaTotalCents: number): Promise<void> {
    await db
      .insert(salesDailySummary)
      .values({ date, transactionCount: deltaTransactionCount, totalCents: deltaTotalCents })
      .onConflictDoUpdate({
        target: salesDailySummary.date,
        set: {
          transactionCount: sql`${salesDailySummary.transactionCount} + ${deltaTransactionCount}`,
          totalCents: sql`${salesDailySummary.totalCents} + ${deltaTotalCents}`,
          updatedAt: new Date(),
        },
      });
  }

  async list(db: TenantDb, cursor: string | undefined, limit: number): Promise<SalesSummaryPage> {
    const rows = await db
      .select()
      .from(salesDailySummary)
      .where(cursor ? lt(salesDailySummary.date, cursor) : undefined)
      .orderBy(desc(salesDailySummary.date))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.date : undefined;

    return { items: page.map(toDomain), ...(nextCursor !== undefined ? { nextCursor } : {}) };
  }
}
