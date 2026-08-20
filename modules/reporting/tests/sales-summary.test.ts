import { describe, expect, it } from "vitest";
import { DOMAIN_EVENT_TYPES } from "@erp/events";
import { createOrderPaidReportConsumer } from "../src/application/order-paid-report-consumer";
import { getSalesSummary } from "../src/application/get-sales-summary";
import { FakeSalesSummaryRepository, fakeDb } from "./fakes";

describe("createOrderPaidReportConsumer", () => {
  it("has the id/eventType a publisher dispatches on", () => {
    const consumer = createOrderPaidReportConsumer(new FakeSalesSummaryRepository());
    expect(consumer.id).toBe("reporting.order-paid");
    expect(consumer.eventType).toBe(DOMAIN_EVENT_TYPES.ORDER_PAID);
  });

  it("increments the summary row for the event's own createdAt date, not wall-clock time", async () => {
    const repository = new FakeSalesSummaryRepository();
    const consumer = createOrderPaidReportConsumer(repository);

    await consumer.handle(
      {
        eventId: "event-1",
        aggregateId: "tx-1",
        eventType: DOMAIN_EVENT_TYPES.ORDER_PAID,
        version: 1,
        createdAt: new Date("2026-08-19T23:30:00.000Z"),
        payload: { totalCents: 1500 },
      },
      fakeDb,
    );

    const page = await getSalesSummary(repository, fakeDb, { limit: 10 });
    expect(page.items).toEqual([{ date: "2026-08-19", transactionCount: 1, totalCents: 1500, updatedAt: expect.any(Date) }]);
  });

  it("accumulates multiple sales on the same day into one row", async () => {
    const repository = new FakeSalesSummaryRepository();
    const consumer = createOrderPaidReportConsumer(repository);
    const day = new Date("2026-08-19T10:00:00.000Z");

    await consumer.handle({ eventId: "e1", aggregateId: "tx-1", eventType: DOMAIN_EVENT_TYPES.ORDER_PAID, version: 1, createdAt: day, payload: { totalCents: 1000 } }, fakeDb);
    await consumer.handle({ eventId: "e2", aggregateId: "tx-2", eventType: DOMAIN_EVENT_TYPES.ORDER_PAID, version: 1, createdAt: day, payload: { totalCents: 2500 } }, fakeDb);

    const page = await getSalesSummary(repository, fakeDb, { limit: 10 });
    expect(page.items).toEqual([{ date: "2026-08-19", transactionCount: 2, totalCents: 3500, updatedAt: expect.any(Date) }]);
  });
});

describe("getSalesSummary", () => {
  it("paginates newest-date-first with a cursor", async () => {
    const repository = new FakeSalesSummaryRepository();
    for (const date of ["2026-08-17", "2026-08-18", "2026-08-19"]) {
      await repository.incrementForDate(fakeDb, date, 1, 100);
    }

    const firstPage = await getSalesSummary(repository, fakeDb, { limit: 2 });
    expect(firstPage.items.map((row) => row.date)).toEqual(["2026-08-19", "2026-08-18"]);
    expect(firstPage.nextCursor).toBe("2026-08-18");

    const secondPage = await getSalesSummary(repository, fakeDb, { ...(firstPage.nextCursor ? { cursor: firstPage.nextCursor } : {}), limit: 2 });
    expect(secondPage.items.map((row) => row.date)).toEqual(["2026-08-17"]);
    expect(secondPage.nextCursor).toBeUndefined();
  });
});
