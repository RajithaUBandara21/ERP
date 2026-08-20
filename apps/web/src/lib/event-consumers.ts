import type { EventConsumer } from "@erp/events";
import { createOrderPaidConsumer, DrizzleDeliveryRepository } from "@erp/delivery";
import { createOrderPaidReportConsumer, DrizzleSalesSummaryRepository } from "@erp/reporting";

/**
 * The application's registered event consumers. EVENTS.md §6's worked
 * example ("delivery module (consumer, if applicable): idempotently
 * creates a pending Delivery") was the first one wired; reporting's sales
 * summary (Phase 14) is the second, both reacting to the same OrderPaid
 * event independently. Adding a consumer here is the only step a future
 * module needs to react to an existing event type; it never touches the
 * producer or the publisher.
 */
export function getEventConsumers(): EventConsumer[] {
  return [createOrderPaidConsumer(new DrizzleDeliveryRepository()), createOrderPaidReportConsumer(new DrizzleSalesSummaryRepository())];
}
