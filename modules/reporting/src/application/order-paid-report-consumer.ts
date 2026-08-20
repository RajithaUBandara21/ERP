import type { TenantDb } from "@erp/database";
import type { DomainEvent, EventConsumer } from "@erp/events";
import { DOMAIN_EVENT_TYPES } from "@erp/events";
import type { SalesSummaryRepository } from "./sales-summary-repository";

interface OrderPaidPayload {
  totalCents: number;
}

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Builds reporting's own read model from pos's OrderPaid event — never
 * reads or writes pos's tables (CLAUDE.md §10). Buckets by the event's own
 * `createdAt` (when the sale was recorded), not by wall-clock time when
 * this consumer happens to run — a late/retried delivery still lands in
 * the correct day's bucket.
 */
export function createOrderPaidReportConsumer(repository: SalesSummaryRepository): EventConsumer<OrderPaidPayload> {
  return {
    id: "reporting.order-paid",
    eventType: DOMAIN_EVENT_TYPES.ORDER_PAID,
    async handle(event: DomainEvent<OrderPaidPayload>, db: TenantDb): Promise<void> {
      await repository.incrementForDate(db, utcDateString(event.createdAt), 1, event.payload.totalCents);
    },
  };
}
