import type { TenantDb } from "@erp/database";
import type { PaymentAttempt } from "../domain/payment-attempt";
import type { Refund } from "../domain/refund";

export interface CreatePaymentAttemptInput {
  reference: string;
  method: string;
  provider: string;
  amountCents: number;
  capturedAmountCents: number;
  providerTransactionId: string;
  idempotencyKey: string;
  status: PaymentAttempt["status"];
}

export interface PaymentAttemptRepository {
  findByIdempotencyKey(db: TenantDb, idempotencyKey: string): Promise<PaymentAttempt | undefined>;
  findById(db: TenantDb, id: string): Promise<PaymentAttempt | undefined>;
  create(db: TenantDb, input: CreatePaymentAttemptInput): Promise<PaymentAttempt>;
  /**
   * Row-locks the payment attempt, applies a refund atomically: validates
   * `refundedAmountCents + refund.amountCents <= capturedAmountCents`,
   * updates the running total and status, and inserts the Refund row — same
   * ledger+projection pattern as modules/inventory's
   * DrizzleStockRepository.applyMovement. Throws
   * RefundExceedsCapturedAmountError if the invariant would be violated.
   */
  applyRefund(
    db: TenantDb,
    input: { paymentAttemptId: string; amountCents: number; reason: string | null; providerRefundId: string },
  ): Promise<{ paymentAttempt: PaymentAttempt; refund: Refund }>;
}
