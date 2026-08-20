import { describe, expect, it } from "vitest";
import { DOMAIN_EVENT_TYPES } from "@erp/events";
import { checkout, PaymentCaptureFailedError } from "../src/application/checkout";
import { CartNotOpenError, EmptyCartError } from "../src/domain/cart";
import {
  fakeDb,
  FakeCartRepository,
  FakeOutboxRepository,
  FakePaymentCapturePort,
  FakePosTransactionRepository,
  FakeStockReservationPort,
} from "./fakes";

const VALID_KEY = "POS-TERM-001-20260819-000123";

function deps() {
  const cartRepository = new FakeCartRepository();
  const transactionRepository = new FakePosTransactionRepository();
  const stockReservationPort = new FakeStockReservationPort();
  const paymentCapturePort = new FakePaymentCapturePort();
  const outboxRepository = new FakeOutboxRepository();
  return { cartRepository, transactionRepository, stockReservationPort, paymentCapturePort, outboxRepository };
}

describe("checkout", () => {
  it("completes a sale: computes totals, reserves stock, captures payment, records the transaction, closes the cart", async () => {
    const d = deps();
    const cart = d.cartRepository.seed({
      terminalId: "terminal-1",
      customerId: null,
      status: "open",
      lines: [{ id: "line-1", sku: "SKU-1", name: "Widget", quantity: 2, unitPriceCents: 500 }],
    });

    const transaction = await checkout(d, fakeDb, "tenant-1", {
      cartId: cart.id,
      idempotencyKey: VALID_KEY,
      paymentMethod: "cash",
    });

    expect(transaction.subtotalCents).toBe(1000);
    expect(transaction.totalCents).toBe(1000);
    expect(transaction.status).toBe("completed");

    expect(d.stockReservationPort.reserveCalls).toHaveLength(1);
    expect(d.stockReservationPort.confirmCalls).toHaveLength(1);
    expect(d.stockReservationPort.releaseCalls).toHaveLength(0);
    expect(d.stockReservationPort.reserveCalls[0]?.reference).toBe(cart.id);
    expect(d.paymentCapturePort.calls).toEqual([{ tenantId: "tenant-1", idempotencyKey: VALID_KEY, amountCents: 1000, method: "cash" }]);

    const closedCart = await d.cartRepository.findById(fakeDb, cart.id);
    expect(closedCart?.status).toBe("completed");

    // Same-transaction outbox write (ADR-0004) — see checkout.ts's doc comment.
    expect(d.outboxRepository.events).toHaveLength(1);
    expect(d.outboxRepository.events[0]).toMatchObject({
      eventType: DOMAIN_EVENT_TYPES.ORDER_PAID,
      aggregateId: transaction.id,
      payload: { transactionId: transaction.id, totalCents: 1000, paymentMethod: "cash" },
    });
  });

  it("adds tax on top of the subtotal when provided", async () => {
    const d = deps();
    const cart = d.cartRepository.seed({
      terminalId: "terminal-1",
      customerId: null,
      status: "open",
      lines: [{ id: "line-1", sku: "SKU-1", name: "Widget", quantity: 1, unitPriceCents: 1000 }],
    });

    const transaction = await checkout(d, fakeDb, "tenant-1", {
      cartId: cart.id,
      idempotencyKey: VALID_KEY,
      paymentMethod: "cash",
      taxCents: 80,
    });

    expect(transaction.subtotalCents).toBe(1000);
    expect(transaction.taxCents).toBe(80);
    expect(transaction.totalCents).toBe(1080);
  });

  it("CRITICAL: retrying with the same idempotency key returns the original transaction, never a duplicate", async () => {
    const d = deps();
    const cart = d.cartRepository.seed({
      terminalId: "terminal-1",
      customerId: null,
      status: "open",
      lines: [{ id: "line-1", sku: "SKU-1", name: "Widget", quantity: 1, unitPriceCents: 500 }],
    });

    const first = await checkout(d, fakeDb, "tenant-1", { cartId: cart.id, idempotencyKey: VALID_KEY, paymentMethod: "cash" });
    // Note: the cart is now "completed" — a real retry wouldn't even need the
    // cart to still be open, because the idempotency check short-circuits
    // before the cart is ever looked at again.
    const second = await checkout(d, fakeDb, "tenant-1", { cartId: cart.id, idempotencyKey: VALID_KEY, paymentMethod: "cash" });

    expect(second.id).toBe(first.id);
    // Side effects (stock reservation, payment capture) must not repeat on retry.
    expect(d.stockReservationPort.reserveCalls).toHaveLength(1);
    expect(d.paymentCapturePort.calls).toHaveLength(1);
  });

  it("rejects checkout on an empty cart", async () => {
    const d = deps();
    const cart = d.cartRepository.seed({ terminalId: "terminal-1", customerId: null, status: "open", lines: [] });

    await expect(
      checkout(d, fakeDb, "tenant-1", { cartId: cart.id, idempotencyKey: VALID_KEY, paymentMethod: "cash" }),
    ).rejects.toThrow(EmptyCartError);
    expect(d.stockReservationPort.reserveCalls).toHaveLength(0);
  });

  it("rejects checkout on an already-completed cart", async () => {
    const d = deps();
    const cart = d.cartRepository.seed({
      terminalId: "terminal-1",
      customerId: null,
      status: "completed",
      lines: [{ id: "line-1", sku: "SKU-1", name: "Widget", quantity: 1, unitPriceCents: 500 }],
    });

    await expect(
      checkout(d, fakeDb, "tenant-1", { cartId: cart.id, idempotencyKey: VALID_KEY, paymentMethod: "cash" }),
    ).rejects.toThrow(CartNotOpenError);
  });

  it("rejects a malformed idempotency key before touching the cart at all", async () => {
    const d = deps();
    const cart = d.cartRepository.seed({
      terminalId: "terminal-1",
      customerId: null,
      status: "open",
      lines: [{ id: "line-1", sku: "SKU-1", name: "Widget", quantity: 1, unitPriceCents: 500 }],
    });

    await expect(
      checkout(d, fakeDb, "tenant-1", { cartId: cart.id, idempotencyKey: "not-a-valid-key", paymentMethod: "cash" }),
    ).rejects.toThrow();
    expect(d.stockReservationPort.reserveCalls).toHaveLength(0);
  });

  it("throws PaymentCaptureFailedError when the payment port declines, releases the reservation, and does not record a transaction", async () => {
    const cartRepository = new FakeCartRepository();
    const transactionRepository = new FakePosTransactionRepository();
    const stockReservationPort = new FakeStockReservationPort();
    const paymentCapturePort = new FakePaymentCapturePort({ success: false });
    const outboxRepository = new FakeOutboxRepository();
    const cart = cartRepository.seed({
      terminalId: "terminal-1",
      customerId: null,
      status: "open",
      lines: [{ id: "line-1", sku: "SKU-1", name: "Widget", quantity: 1, unitPriceCents: 500 }],
    });

    await expect(
      checkout(
        { cartRepository, transactionRepository, stockReservationPort, paymentCapturePort, outboxRepository },
        fakeDb,
        "tenant-1",
        { cartId: cart.id, idempotencyKey: VALID_KEY, paymentMethod: "card" },
      ),
    ).rejects.toThrow(PaymentCaptureFailedError);

    const recorded = await transactionRepository.findByIdempotencyKey(fakeDb, VALID_KEY);
    expect(recorded).toBeUndefined();
    const cartAfter = await cartRepository.findById(fakeDb, cart.id);
    expect(cartAfter?.status).toBe("open"); // never closed on a failed payment

    // The compensating action: reserved stock is released, never confirmed, on payment failure.
    expect(stockReservationPort.reserveCalls).toHaveLength(1);
    expect(stockReservationPort.releaseCalls).toHaveLength(1);
    expect(stockReservationPort.confirmCalls).toHaveLength(0);
    expect(stockReservationPort.releaseCalls[0]?.reference).toBe(cart.id);

    // No sale, no event — nothing was ever paid for.
    expect(outboxRepository.events).toHaveLength(0);
  });
});
