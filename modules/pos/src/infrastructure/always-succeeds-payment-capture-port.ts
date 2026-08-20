import type { PaymentCaptureResult, PaymentCapturePort } from "../application/payment-capture-port";

/** Phase 8 stand-in — see payment-capture-port.ts's doc comment. Still used by tests/fakes that don't care about payments. */
export class AlwaysSucceedsPaymentCapturePort implements PaymentCapturePort {
  async capturePayment(): Promise<PaymentCaptureResult> {
    return { success: true };
  }
}
