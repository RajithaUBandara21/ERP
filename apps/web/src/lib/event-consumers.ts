import type { EventConsumer } from "@erp/events";
import { createOrderPaidConsumer, DrizzleDeliveryRepository } from "@erp/delivery";

/**
 * The application's registered event consumers — EVENTS.md §6's worked
 * example ("delivery module (consumer, if applicable): idempotently
 * creates a pending Delivery") is the only one wired so far. Adding a
 * consumer here is the only step a future module needs to react to an
 * existing event type; it never touches the producer or the publisher.
 */
export function getEventConsumers(): EventConsumer[] {
  return [createOrderPaidConsumer(new DrizzleDeliveryRepository())];
}
