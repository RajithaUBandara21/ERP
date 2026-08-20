export class RefundExceedsCapturedAmountError extends Error {
  constructor(
    public readonly paymentAttemptId: string,
    public readonly requested: number,
    public readonly remaining: number,
  ) {
    super(`Refund of ${requested} exceeds remaining refundable amount ${remaining} on payment attempt ${paymentAttemptId}`);
    this.name = "RefundExceedsCapturedAmountError";
  }
}

export class PaymentAttemptNotSucceededError extends Error {
  constructor(paymentAttemptId: string) {
    super(`Payment attempt ${paymentAttemptId} has not succeeded and cannot be refunded`);
    this.name = "PaymentAttemptNotSucceededError";
  }
}

export class UnsupportedPaymentMethodError extends Error {
  constructor(method: string) {
    super(`No payment provider registered for method '${method}'`);
    this.name = "UnsupportedPaymentMethodError";
  }
}

/** A provider adapter's own failure (declined, network error, etc.) — distinct from a programming/integration error. */
export class ProviderError extends Error {
  constructor(provider: string, reason: string) {
    super(`Payment provider '${provider}' failed: ${reason}`);
    this.name = "ProviderError";
  }
}
