import { describe, expect, it } from "vitest";
import type { EventConsumer } from "../src/domain/consumer";
import { DOMAIN_EVENT_TYPES } from "../src/domain/domain-event";
import { MAX_DELIVERY_ATTEMPTS, publishPendingEvents } from "../src/application/publish-pending-events";
import { writeOutboxEvent } from "../src/application/write-outbox-event";
import { FakeOutboxRepository, fakeDb } from "./fakes";

function recordingConsumer(id: string, eventType: string, calls: string[], shouldFail = false): EventConsumer {
  return {
    id,
    eventType,
    async handle(event) {
      calls.push(`${id}:${event.eventId}`);
      if (shouldFail) throw new Error("handler failed");
    },
  };
}

describe("publishPendingEvents", () => {
  it("delivers a pending event to every consumer registered for its event type", async () => {
    const repository = new FakeOutboxRepository();
    await writeOutboxEvent(repository, fakeDb, {
      aggregateId: "tx-1",
      eventType: DOMAIN_EVENT_TYPES.ORDER_PAID,
      payload: { transactionId: "tx-1" },
    });

    const calls: string[] = [];
    const consumers = [
      recordingConsumer("accounting.order-paid", DOMAIN_EVENT_TYPES.ORDER_PAID, calls),
      recordingConsumer("delivery.order-paid", DOMAIN_EVENT_TYPES.ORDER_PAID, calls),
      recordingConsumer("irrelevant.stock-reserved", DOMAIN_EVENT_TYPES.STOCK_RESERVED, calls),
    ];

    const result = await publishPendingEvents(repository, fakeDb, consumers);

    expect(result.eventsProcessed).toBe(1);
    expect(result.deliveries).toBe(2); // only the two ORDER_PAID consumers, not the irrelevant one
    expect(calls).toHaveLength(2);
  });

  it("marks a fully-delivered event so a second publish cycle doesn't redeliver it", async () => {
    const repository = new FakeOutboxRepository();
    await writeOutboxEvent(repository, fakeDb, { aggregateId: "tx-1", eventType: DOMAIN_EVENT_TYPES.ORDER_PAID, payload: {} });

    const calls: string[] = [];
    const consumers = [recordingConsumer("delivery.order-paid", DOMAIN_EVENT_TYPES.ORDER_PAID, calls)];

    await publishPendingEvents(repository, fakeDb, consumers);
    await publishPendingEvents(repository, fakeDb, consumers);

    expect(calls).toHaveLength(1); // not redelivered on the second cycle
    const pending = await repository.findPending(fakeDb, 10);
    expect(pending).toHaveLength(0); // no longer "pending" once fully delivered
  });

  it("a failing consumer does not block a different, successful consumer for the same event", async () => {
    const repository = new FakeOutboxRepository();
    await writeOutboxEvent(repository, fakeDb, { aggregateId: "tx-1", eventType: DOMAIN_EVENT_TYPES.ORDER_PAID, payload: {} });

    const calls: string[] = [];
    const consumers = [
      recordingConsumer("failing-consumer", DOMAIN_EVENT_TYPES.ORDER_PAID, calls, true),
      recordingConsumer("succeeding-consumer", DOMAIN_EVENT_TYPES.ORDER_PAID, calls),
    ];

    const result = await publishPendingEvents(repository, fakeDb, consumers);

    expect(result.deliveries).toBe(1);
    expect(result.failures).toBe(1);
    expect(calls).toEqual(expect.arrayContaining([expect.stringContaining("succeeding-consumer")]));

    // The event stays pending (one consumer still owes a successful delivery), retried on the next cycle.
    const pending = await repository.findPending(fakeDb, 10);
    expect(pending).toHaveLength(1);
  });

  it("dead-letters an event after MAX_DELIVERY_ATTEMPTS consecutive failures for one consumer, and stops retrying it", async () => {
    const repository = new FakeOutboxRepository();
    const event = await writeOutboxEvent(repository, fakeDb, { aggregateId: "tx-1", eventType: DOMAIN_EVENT_TYPES.ORDER_PAID, payload: {} });

    const calls: string[] = [];
    const consumers = [recordingConsumer("poison-consumer", DOMAIN_EVENT_TYPES.ORDER_PAID, calls, true)];

    for (let i = 0; i < MAX_DELIVERY_ATTEMPTS; i++) {
      await publishPendingEvents(repository, fakeDb, consumers);
    }

    expect(calls).toHaveLength(MAX_DELIVERY_ATTEMPTS);
    const pending = await repository.findPending(fakeDb, 10);
    expect(pending).toHaveLength(0); // no longer retried

    const deadLettered = await repository.findDeadLettered(fakeDb);
    expect(deadLettered.map((e) => e.eventId)).toContain(event.eventId);

    // One more cycle must not invoke the handler again — it's dead, not "still pending."
    await publishPendingEvents(repository, fakeDb, consumers);
    expect(calls).toHaveLength(MAX_DELIVERY_ATTEMPTS);
  });

  it("skips a batch with no matching consumers without error", async () => {
    const repository = new FakeOutboxRepository();
    await writeOutboxEvent(repository, fakeDb, { aggregateId: "tx-1", eventType: DOMAIN_EVENT_TYPES.ORDER_PAID, payload: {} });

    const result = await publishPendingEvents(repository, fakeDb, []);

    expect(result.eventsProcessed).toBe(1);
    expect(result.deliveries).toBe(0);
    // Zero relevant consumers vacuously "all succeeded" -- marked delivered, not stuck pending forever.
    const pending = await repository.findPending(fakeDb, 10);
    expect(pending).toHaveLength(0);
  });
});
