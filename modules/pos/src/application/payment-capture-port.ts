/**
 * Seam for the real payments integration (Phase 10) — see
 * ARCHITECTURE.md §4 and docs/modules/payments.md's PaymentService
 * abstraction. checkout() depends on this port, not a concrete provider;
 * infrastructure/always-succeeds-payment-capture.ts is wired in until
 * Phase 10 provides a real Drizzle/provider-backed implementation.
 */
export interface PaymentCaptureResult {
  success: boolean;
  providerReference?: string;
}

export interface PaymentCapturePort {
  capturePayment(tenantId: string, amountCents: number, method: string): Promise<PaymentCaptureResult>;
}
