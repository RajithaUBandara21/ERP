import { describe, expect, it } from "vitest";
import { capturePayment } from "../src/application/capture-payment";
import { refundPayment } from "../src/application/refund-payment";
import { PaymentAttemptNotSucceededError, RefundExceedsCapturedAmountError } from "../src/domain/errors";
import { PaymentAttemptNotFoundError } from "../src/domain/payment-attempt";
import { FakePaymentAttemptRepository, FakePaymentProvider, fakeDb } from "./fakes";

async function capturedAttempt(paymentAttemptRepository: FakePaymentAttemptRepository, cash: FakePaymentProvider) {
  return capturePayment(
    { paymentAttemptRepository, providers: { cash } },
    fakeDb,
    { reference: "cart-1", method: "cash", amountCents: 1000, idempotencyKey: "POS-TERM-001-20260819-000001" },
  );
}

describe("refundPayment", () => {
  it("fully refunds a captured payment", async () => {
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const cash = new FakePaymentProvider("cash");
    const attempt = await capturedAttempt(paymentAttemptRepository, cash);

    const { paymentAttempt, refund } = await refundPayment(
      { paymentAttemptRepository, providers: { cash } },
      fakeDb,
      { paymentAttemptId: attempt.id, amountCents: 1000, reason: "customer changed mind" },
    );

    expect(paymentAttempt.status).toBe("refunded");
    expect(paymentAttempt.refundedAmountCents).toBe(1000);
    expect(refund.amountCents).toBe(1000);
    expect(cash.refundCalls).toHaveLength(1);
  });

  it("supports a partial refund, leaving status partially_refunded", async () => {
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const cash = new FakePaymentProvider("cash");
    const attempt = await capturedAttempt(paymentAttemptRepository, cash);

    const { paymentAttempt } = await refundPayment(
      { paymentAttemptRepository, providers: { cash } },
      fakeDb,
      { paymentAttemptId: attempt.id, amountCents: 400 },
    );

    expect(paymentAttempt.status).toBe("partially_refunded");
    expect(paymentAttempt.refundedAmountCents).toBe(400);
  });

  it("rejects a refund exceeding the remaining refundable amount", async () => {
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const cash = new FakePaymentProvider("cash");
    const attempt = await capturedAttempt(paymentAttemptRepository, cash);

    await expect(
      refundPayment({ paymentAttemptRepository, providers: { cash } }, fakeDb, { paymentAttemptId: attempt.id, amountCents: 1001 }),
    ).rejects.toThrow(RefundExceedsCapturedAmountError);
  });

  it("rejects refunding a payment attempt that was never captured successfully", async () => {
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const declining = new FakePaymentProvider("cash", { success: false, providerTransactionId: "TX", failureReason: "declined" });
    const failed = await capturePayment(
      { paymentAttemptRepository, providers: { cash: declining } },
      fakeDb,
      { reference: "cart-2", method: "cash", amountCents: 500, idempotencyKey: "POS-TERM-001-20260819-000002" },
    );

    await expect(
      refundPayment({ paymentAttemptRepository, providers: { cash: declining } }, fakeDb, { paymentAttemptId: failed.id, amountCents: 100 }),
    ).rejects.toThrow(PaymentAttemptNotSucceededError);
  });

  it("throws PaymentAttemptNotFoundError for an unknown id", async () => {
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const cash = new FakePaymentProvider("cash");
    await expect(
      refundPayment({ paymentAttemptRepository, providers: { cash } }, fakeDb, { paymentAttemptId: "nope", amountCents: 100 }),
    ).rejects.toThrow(PaymentAttemptNotFoundError);
  });

  it("rejects a non-positive refund amount", async () => {
    const paymentAttemptRepository = new FakePaymentAttemptRepository();
    const cash = new FakePaymentProvider("cash");
    const attempt = await capturedAttempt(paymentAttemptRepository, cash);

    await expect(
      refundPayment({ paymentAttemptRepository, providers: { cash } }, fakeDb, { paymentAttemptId: attempt.id, amountCents: 0 }),
    ).rejects.toThrow(RangeError);
  });
});
