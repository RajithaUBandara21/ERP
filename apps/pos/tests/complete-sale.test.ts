import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { completeSaleOffline } from "../src/lib/complete-sale";
import { listPendingSales, resetPosDbForTests, saveTerminalRecord } from "../src/lib/db";

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  resetPosDbForTests();
  await saveTerminalRecord({
    id: "current",
    tenantHost: "acme.platform.example.com",
    terminalId: "f1bb4036-f32d-47d4-a7a4-c061911b41ce",
    deviceId: "device-1",
    terminalName: "Front Counter",
    registeredAt: new Date().toISOString(),
    saleSequence: 0,
  });
});

describe("completeSaleOffline", () => {
  it("writes a durable pending sale immediately, without any network call", async () => {
    const sale = await completeSaleOffline({
      lines: [{ sku: "SKU-1", name: "Widget", quantity: 2, unitPriceCents: 500 }],
      paymentMethod: "cash",
    });

    expect(sale.status).toBe("pending");
    expect(sale.idempotencyKey).toMatch(/^POS-F1BB4036-\d{8}-000001$/);

    const stored = await listPendingSales();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.localId).toBe(sale.localId);
  });

  it("assigns a distinct, increasing idempotency key to each successive sale", async () => {
    const first = await completeSaleOffline({ lines: [{ sku: "SKU-1", name: "Widget", quantity: 1, unitPriceCents: 500 }], paymentMethod: "cash" });
    const second = await completeSaleOffline({ lines: [{ sku: "SKU-2", name: "Gadget", quantity: 1, unitPriceCents: 999 }], paymentMethod: "cash" });

    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
    expect(first.idempotencyKey.endsWith("000001")).toBe(true);
    expect(second.idempotencyKey.endsWith("000002")).toBe(true);
  });

  it("rejects completing a sale with no lines", async () => {
    await expect(completeSaleOffline({ lines: [], paymentMethod: "cash" })).rejects.toThrow("no lines");
  });

  it("throws if no terminal has been set up yet", async () => {
    globalThis.indexedDB = new IDBFactory();
    resetPosDbForTests();
    await expect(
      completeSaleOffline({ lines: [{ sku: "SKU-1", name: "Widget", quantity: 1, unitPriceCents: 500 }], paymentMethod: "cash" }),
    ).rejects.toThrow("complete setup first");
  });
});
