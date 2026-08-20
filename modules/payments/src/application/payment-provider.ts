/**
 * The provider adapter seam — CLAUDE.md §33's PaymentService abstraction
 * (docs/modules/payments.md). No order/cart logic ever hardcodes a
 * provider; capture-payment.ts resolves one from a method → provider map
 * supplied by its caller. Raw card data never crosses this boundary —
 * `paymentMethodToken` is an opaque, already-tokenized reference (CLAUDE.md
 * §33: "never store raw card data, use provider tokenization").
 */
export interface ProviderCaptureInput {
  amountCents: number;
  paymentMethodToken?: string;
}

export interface ProviderCaptureResult {
  success: boolean;
  providerTransactionId: string;
  /** Present only when success is false — never a generic "declined", so callers can log/audit the real reason. */
  failureReason?: string;
}

export interface ProviderRefundInput {
  providerTransactionId: string;
  amountCents: number;
}

export interface ProviderRefundResult {
  success: boolean;
  providerRefundId: string;
  failureReason?: string;
}

export interface PaymentProvider {
  readonly id: string;
  capture(input: ProviderCaptureInput): Promise<ProviderCaptureResult>;
  refund(input: ProviderRefundInput): Promise<ProviderRefundResult>;
}
