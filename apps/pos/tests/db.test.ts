import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import {
  getSyncableSales,
  getTerminalRecord,
  listPendingSales,
  nextSaleSequence,
  resetPosDbForTests,
  savePendingSale,
  saveTerminalRecord,
  type PendingSale,
} from "../src/lib/db";

// Fresh in-memory IndexedDB *and* a cleared connection cache per test —
// db.ts memoizes its openDB() connection at module scope, so swapping the
// global indexedDB factory alone wouldn't be enough; resetPosDbForTests()
// is the seam that makes the next getPosDb() call open fresh.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetPosDbForTests();
});

function sale(overrides: Partial<PendingSale> = {}): PendingSale {
  return {
    localId: crypto.randomUUID(),
    idempotencyKey: "POS-TERM0001-20260819-000001",
    lines: [{ sku: "SKU-1", name: "Widget", quantity: 1, unitPriceCents: 500 }],
    paymentMethod: "cash",
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
    ...overrides,
  };
}

describe("terminal record", () => {
  it("round-trips a saved terminal record", async () => {
    expect(await getTerminalRecord()).toBeUndefined();
    await saveTerminalRecord({
      id: "current",
      tenantHost: "acme.platform.example.com",
      terminalId: "term-1",
      deviceId: "device-1",
      terminalName: "Front Counter",
      registeredAt: new Date().toISOString(),
      saleSequence: 0,
    });
    const record = await getTerminalRecord();
    expect(record?.terminalId).toBe("term-1");
  });

  it("nextSaleSequence increments atomically and persists", async () => {
    await saveTerminalRecord({
      id: "current",
      tenantHost: "acme.platform.example.com",
      terminalId: "term-1",
      deviceId: "device-1",
      terminalName: "Front Counter",
      registeredAt: new Date().toISOString(),
      saleSequence: 0,
    });
    expect(await nextSaleSequence()).toBe(1);
    expect(await nextSaleSequence()).toBe(2);
    expect(await nextSaleSequence()).toBe(3);
    expect((await getTerminalRecord())?.saleSequence).toBe(3);
  });
});

describe("pending sales", () => {
  it("lists sales ordered by createdAt", async () => {
    const first = sale({ createdAt: "2026-08-19T10:00:00.000Z" });
    const second = sale({ createdAt: "2026-08-19T11:00:00.000Z" });
    await savePendingSale(second);
    await savePendingSale(first);

    const sales = await listPendingSales();
    expect(sales.map((s) => s.localId)).toEqual([first.localId, second.localId]);
  });

  it("getSyncableSales includes pending sales and due failed retries, excludes not-yet-due retries", async () => {
    const now = new Date("2026-08-19T12:00:00.000Z");
    const pending = sale({ status: "pending" });
    const dueRetry = sale({ status: "failed", nextRetryAt: "2026-08-19T11:59:00.000Z" });
    const notYetDue = sale({ status: "failed", nextRetryAt: "2026-08-19T12:05:00.000Z" });
    const synced = sale({ status: "synced" });
    const conflict = sale({ status: "conflict" });

    for (const s of [pending, dueRetry, notYetDue, synced, conflict]) await savePendingSale(s);

    const syncable = await getSyncableSales(now);
    const ids = syncable.map((s) => s.localId).sort();
    expect(ids).toEqual([dueRetry.localId, pending.localId].sort());
  });
});
