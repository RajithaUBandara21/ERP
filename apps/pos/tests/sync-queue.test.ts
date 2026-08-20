import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { resetPosDbForTests, savePendingSale, type PendingSale } from "../src/lib/db";
import type * as ApiClientModule from "../src/lib/api-client";

vi.mock("../src/lib/api-client", async () => {
  const actual = await vi.importActual<typeof ApiClientModule>("../src/lib/api-client");
  return {
    ...actual,
    createCart: vi.fn(),
    addCartLine: vi.fn(),
    checkout: vi.fn(),
  };
});

import * as api from "../src/lib/api-client";
import { ApiError, NetworkError } from "../src/lib/api-client";
import { backoffMs, drainSyncQueue, syncOneSale } from "../src/lib/sync-queue";

const TENANT_HOST = "acme.platform.example.com";
const TERMINAL_ID = "terminal-1";

function sale(overrides: Partial<PendingSale> = {}): PendingSale {
  return {
    localId: crypto.randomUUID(),
    idempotencyKey: "POS-TERM0001-20260819-000001",
    lines: [{ sku: "SKU-1", name: "Widget", quantity: 2, unitPriceCents: 500 }],
    paymentMethod: "cash",
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetPosDbForTests();
  vi.clearAllMocks();
});

describe("syncOneSale", () => {
  it("creates a cart, adds every line, checks out, and marks the sale synced", async () => {
    vi.mocked(api.createCart).mockResolvedValue({ id: "cart-1" });
    vi.mocked(api.addCartLine).mockResolvedValue(undefined);
    vi.mocked(api.checkout).mockResolvedValue({ id: "tx-1", status: "completed", totalCents: 1000 });

    const target = sale();
    const result = await syncOneSale(TENANT_HOST, TERMINAL_ID, target);

    expect(result.status).toBe("synced");
    expect(result.serverTransactionId).toBe("tx-1");
    expect(api.createCart).toHaveBeenCalledWith(TENANT_HOST, TERMINAL_ID);
    expect(api.addCartLine).toHaveBeenCalledWith(TENANT_HOST, "cart-1", target.lines[0]);
    expect(api.checkout).toHaveBeenCalledWith(TENANT_HOST, "cart-1", expect.objectContaining({ idempotencyKey: target.idempotencyKey }));
  });

  it("marks a network failure as 'failed' with a scheduled retry, not 'conflict'", async () => {
    vi.mocked(api.createCart).mockRejectedValue(new NetworkError(new TypeError("fetch failed")));

    const result = await syncOneSale(TENANT_HOST, TERMINAL_ID, sale());

    expect(result.status).toBe("failed");
    expect(result.attempts).toBe(1);
    expect(result.nextRetryAt).toBeDefined();
    expect(new Date(result.nextRetryAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it("marks a definitive server rejection (e.g. oversell) as 'conflict', never auto-retried", async () => {
    vi.mocked(api.createCart).mockResolvedValue({ id: "cart-1" });
    vi.mocked(api.addCartLine).mockResolvedValue(undefined);
    vi.mocked(api.checkout).mockRejectedValue(new ApiError(422, "INVENTORY_INSUFFICIENT_STOCK", "Insufficient stock"));

    const result = await syncOneSale(TENANT_HOST, TERMINAL_ID, sale());

    expect(result.status).toBe("conflict");
    expect(result.lastError).toContain("INVENTORY_INSUFFICIENT_STOCK");
    expect(result.nextRetryAt).toBeUndefined();
  });

  it("retrying after a network failure re-creates the cart and re-adds every line, but reuses the same idempotencyKey", async () => {
    vi.mocked(api.createCart).mockResolvedValueOnce({ id: "cart-1" }).mockResolvedValueOnce({ id: "cart-2" });
    vi.mocked(api.addCartLine).mockResolvedValue(undefined);
    vi.mocked(api.checkout)
      .mockRejectedValueOnce(new NetworkError(new TypeError("fetch failed")))
      .mockResolvedValueOnce({ id: "tx-1", status: "completed", totalCents: 1000 });

    const target = sale();
    const failedAttempt = await syncOneSale(TENANT_HOST, TERMINAL_ID, target);
    expect(failedAttempt.status).toBe("failed");

    const retryAttempt = await syncOneSale(TENANT_HOST, TERMINAL_ID, failedAttempt);
    expect(retryAttempt.status).toBe("synced");
    expect(api.createCart).toHaveBeenCalledTimes(2); // a fresh cart each attempt — see sync-queue.ts's doc comment
    expect(api.checkout).toHaveBeenNthCalledWith(1, TENANT_HOST, "cart-1", expect.objectContaining({ idempotencyKey: target.idempotencyKey }));
    expect(api.checkout).toHaveBeenNthCalledWith(2, TENANT_HOST, "cart-2", expect.objectContaining({ idempotencyKey: target.idempotencyKey }));
  });
});

describe("drainSyncQueue", () => {
  it("processes syncable sales in creation order, one at a time", async () => {
    const first = sale({ createdAt: "2026-08-19T10:00:00.000Z", idempotencyKey: "POS-TERM0001-20260819-000001" });
    const second = sale({ createdAt: "2026-08-19T11:00:00.000Z", idempotencyKey: "POS-TERM0001-20260819-000002" });
    await savePendingSale(second);
    await savePendingSale(first);

    const cartIds = ["cart-a", "cart-b"];
    vi.mocked(api.createCart).mockImplementation(async () => ({ id: cartIds.shift()! }));
    vi.mocked(api.addCartLine).mockResolvedValue(undefined);
    const checkoutOrder: string[] = [];
    vi.mocked(api.checkout).mockImplementation(async (_host, _cartId, input) => {
      checkoutOrder.push(input.idempotencyKey);
      return { id: `tx-${input.idempotencyKey}`, status: "completed", totalCents: 1000 };
    });

    await drainSyncQueue(TENANT_HOST, TERMINAL_ID);

    expect(checkoutOrder).toEqual([first.idempotencyKey, second.idempotencyKey]);
  });
});

describe("backoffMs", () => {
  it("grows exponentially and caps at 5 minutes plus jitter", () => {
    expect(backoffMs(1)).toBeGreaterThanOrEqual(30_000);
    expect(backoffMs(1)).toBeLessThan(31_000);
    expect(backoffMs(10)).toBeLessThan(5 * 60_000 + 1000);
  });
});
