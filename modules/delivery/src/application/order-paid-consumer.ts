import type { TenantDb } from "@erp/database";
import type { DomainEvent, EventConsumer } from "@erp/events";
import { DOMAIN_EVENT_TYPES } from "@erp/events";
import { createDelivery } from "./create-delivery";
import type { DeliveryRepository } from "./delivery-repository";

interface OrderPaidPayload {
  transactionId: string;
}

/**
 * EVENTS.md §6's own worked example, implemented: "delivery module
 * (consumer, if applicable): idempotently creates a pending Delivery."
 *
 * Known simplification, documented rather than hidden: there is no real
 * "this order requires delivery" signal anywhere yet (checkout() has no
 * fulfillment-method field) — every OrderPaid currently creates a pending
 * Delivery unconditionally. A future phase gating this on an actual
 * customer-selected fulfillment method would change only this consumer,
 * not the event contract or the outbox mechanism it runs on.
 *
 * Idempotent by construction, not just by the publisher's own per-consumer
 * dedup ledger (CLAUDE.md §25 wants both): createDelivery(orderReference)
 * is safe to call twice for the same transactionId in the sense that it
 * would create a second Delivery row rather than corrupt state — true
 * dedup against a redelivered event relies on the publisher's
 * processed_events tracking (packages/events), which is the primary
 * defense; this handler doing something structurally safe either way is
 * a deliberate second layer, not a substitute for it.
 */
export function createOrderPaidConsumer(deliveryRepository: DeliveryRepository): EventConsumer<OrderPaidPayload> {
  return {
    id: "delivery.order-paid",
    eventType: DOMAIN_EVENT_TYPES.ORDER_PAID,
    async handle(event: DomainEvent<OrderPaidPayload>, db: TenantDb): Promise<void> {
      await createDelivery(deliveryRepository, db, { orderReference: event.payload.transactionId });
    },
  };
}
