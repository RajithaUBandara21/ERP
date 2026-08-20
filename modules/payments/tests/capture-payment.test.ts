import { describe, expect, it } from "vitest";
import { capturePayment } from "../src/application/capture-payment";
import { UnsupportedPaymentMethodError } from "../src/domain/errors";
import { FakePaymentAttemptRepository, FakePaymentProvider, fakeDb } from "./fakes";

const VALID_KEY = "POS-TERM-001-20260819-000123";

describe("capturePayment", () => {
  it("records a successful capture", async () => {
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const cash = new FakePaymentProvider("cash");
    const deps = { paymentAttemptRepository, providers: { cash } };

    const attempt = await capturePayment(deps, fakeDb, {
      reference: "cart-1",
      method: "cash",
      amountCents: 1000,
      idempotencyKey: VALID_KEY,
    });

    expect(attempt.status).toBe("succeeded");
    expect(attempt.capturedAmountCents).toBe(1000);
    expect(attempt.refundedAmountCents).toBe(0);
    expect(cash.captureCalls).toHaveLength(1);
  });

  it("records a declined capture without throwing", async () => {
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const card = new FakePaymentProvider("card", { success: false, providerTransactionId: "CARD-X", failureReason: "declined" });
    const deps = { paymentAttemptRepository, providers: { card } };

    const attempt = await capturePayment(deps, fakeDb, {
      reference: "cart-2",
      method: "card",
      amountCents: 500,
      idempotencyKey: VALID_KEY,
    });

    expect(attempt.status).toBe("failed");
    expect(attempt.capturedAmountCents).toBe(0);
  });

  it("CRITICAL: retrying with the same idempotency key does not call the provider again", async () => {
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const cash = new FakePaymentProvider("cash");
    const deps = { paymentAttemptRepository, providers: { cash } };
    const input = { reference: "cart-3", method: "cash", amountCents: 750, idempotencyKey: VALID_KEY };

    const first = await capturePayment(deps, fakeDb, input);
    const second = await capturePayment(deps, fakeDb, input);

    expect(second.id).toBe(first.id);
    expect(cash.captureCalls).toHaveLength(1); // never charged twice — CLAUDE.md §63
  });

  it("throws UnsupportedPaymentMethodError for a method with no registered provider", async () => {
    const deps = { paymentAttemptRepository: new FakePaymentAttemptRepository(), providers: {} };
    await expect(
      capturePayment(deps, fakeDb, { reference: "cart-4", method: "crypto", amountCents: 100, idempotencyKey: VALID_KEY }),
    ).rejects.toThrow(UnsupportedPaymentMethodError);
  });
});
