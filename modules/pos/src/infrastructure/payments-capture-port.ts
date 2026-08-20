import { getTenantDb } from "@erp/database";
import { CashProvider, capturePayment, DrizzlePaymentAttemptRepository, SimulatedCardProvider } from "@erp/payments";
import type { PaymentCaptureResult, PaymentCapturePort } from "../application/payment-capture-port";

/**
 * Real implementation, Phase 10 — see payment-capture-port.ts's doc
 * comment. Resolves the tenant's own database and dispatches to a
 * provider by `method` ("cash" → CashProvider, everything else →
 * SimulatedCardProvider — see that class's doc comment on why it isn't a
 * real gateway integration yet).
 */
export class PaymentsCapturePort implements PaymentCapturePort {
  private readonly paymentAttemptRepository = new DrizzlePaymentAttemptRepository();
  private readonly providers = { cash: new CashProvider(), card: new SimulatedCardProvider() };

  async capturePayment(
    tenantId: string,
    idempotencyKey: string,
    amountCents: number,
    method: string,
    paymentMethodToken?: string,
  ): Promise<PaymentCaptureResult> {
    const db = await getTenantDb(tenantId);
    const attempt = await capturePayment(
      { paymentAttemptRepository: this.paymentAttemptRepository, providers: this.providers },
      db,
      { reference: idempotencyKey, method, amountCents, idempotencyKey, ...(paymentMethodToken !== undefined ? { paymentMethodToken } : {}) },
    );
    return {
      success: attempt.status === "succeeded",
      providerReference: attempt.providerTransactionId,
    };
  }
}
