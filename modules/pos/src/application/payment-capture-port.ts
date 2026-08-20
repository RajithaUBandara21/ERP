/**
 * Seam for the real payments integration — see ARCHITECTURE.md §4 and
 * docs/modules/payments.md's PaymentService abstraction. checkout()
 * depends on this port, not a concrete provider. Phase 10 adds the real
 * implementation (infrastructure/payments-capture-port.ts, calling into
 * @erp/payments's capturePayment); infrastructure/
 * always-succeeds-payment-capture-port.ts (the Phase 8 stand-in) is still
 * used by fakes/tests that don't care about payments.
 *
 * `idempotencyKey` is the SAME key checkout() uses to guard PosTransaction
 * creation — one key covers the whole checkout, including the payment
 * capture, so a retried checkout never captures twice (CLAUDE.md §63:
 * "never retry payments blindly").
 */
export interface PaymentCaptureResult {
  success: boolean;
  providerReference?: string;
}

export interface PaymentCapturePort {
  capturePayment(
    tenantId: string,
    idempotencyKey: string,
    amountCents: number,
    method: string,
    paymentMethodToken?: string,
  ): Promise<PaymentCaptureResult>;
}
