import type { TenantDb } from "@erp/database";
import type { SalesSummaryPage, SalesSummaryRepository } from "./sales-summary-repository";

export interface GetSalesSummaryInput {
  cursor?: string;
  limit: number;
}

export async function getSalesSummary(repository: SalesSummaryRepository, db: TenantDb, input: GetSalesSummaryInput): Promise<SalesSummaryPage> {
  return repository.list(db, input.cursor, input.limit);
}
