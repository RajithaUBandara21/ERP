import { describe, expect, it } from "vitest";
import { DOMAIN_EVENT_TYPES } from "@erp/events";
import { createOrderPaidConsumer } from "../src/application/order-paid-consumer";
import { FakeDeliveryRepository, fakeDb } from "./fakes";

describe("createOrderPaidConsumer", () => {
  it("has the id/eventType a publisher dispatches on (EVENTS.md §6's worked example)", () => {
    const consumer = createOrderPaidConsumer(new FakeDeliveryRepository());
    expect(consumer.id).toBe("delivery.order-paid");
    expect(consumer.eventType).toBe(DOMAIN_EVENT_TYPES.ORDER_PAID);
  });

  it("creates a pending Delivery referencing the paid order", async () => {
    const deliveryRepository = new FakeDeliveryRepository();
    const consumer = createOrderPaidConsumer(deliveryRepository);

    await consumer.handle(
      { eventId: "event-1", aggregateId: "tx-1", eventType: DOMAIN_EVENT_TYPES.ORDER_PAID, version: 1, createdAt: new Date(), payload: { transactionId: "tx-1" } },
      fakeDb,
    );

    const deliveries = await deliveryRepository.list(fakeDb);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ orderReference: "tx-1", status: "pending", driverId: null });
  });
});
