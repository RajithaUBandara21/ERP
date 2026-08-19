import type { PaymentCaptureResult, PaymentCapturePort } from "../application/payment-capture-port";

/** Phase 8 stand-in — see payment-capture-port.ts's doc comment. Replaced by a real provider-backed implementation in Phase 10. */
export class AlwaysSucceedsPaymentCapturePort implements PaymentCapturePort {
  async capturePayment(): Promise<PaymentCaptureResult> {
    return { success: true };
  }
}
