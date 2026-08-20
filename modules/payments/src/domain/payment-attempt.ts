export type PaymentAttemptStatus = "succeeded" | "failed" | "refunded" | "partially_refunded";

/**
 * `capturedAmountCents` is set once, at capture time, and never changes —
 * it's the record of what was actually captured. `refundedAmountCents` is
 * the running total of refunds against this attempt, updated
 * transactionally alongside each Refund row (same ledger+projection
 * pattern as modules/inventory's StockLevel — see
 * infrastructure/drizzle-payment-attempt-repository.ts).
 */
export interface PaymentAttempt {
  id: string;
  reference: string;
  method: string;
  provider: string;
  amountCents: number;
  capturedAmountCents: number;
  refundedAmountCents: number;
  providerTransactionId: string;
  idempotencyKey: string;
  status: PaymentAttemptStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentAttemptNotFoundError extends Error {
  constructor(id: string) {
    super(`Payment attempt not found: ${id}`);
    this.name = "PaymentAttemptNotFoundError";
  }
}
