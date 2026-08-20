import { randomUUID } from "node:crypto";
import type { PaymentProvider, ProviderCaptureInput, ProviderCaptureResult, ProviderRefundInput, ProviderRefundResult } from "../application/payment-provider";

/**
 * Cash genuinely has no external provider to call — capture/refund are
 * till operations that happen physically at the register, not network
 * calls. This is a real, complete implementation (not a stand-in like
 * SimulatedCardProvider): it always succeeds because there is nothing to
 * decline, and it exists to prove the PaymentProvider seam with a
 * provider that has zero external dependencies.
 */
export class CashProvider implements PaymentProvider {
  readonly id = "cash";

  async capture(_input: ProviderCaptureInput): Promise<ProviderCaptureResult> {
    return { success: true, providerTransactionId: `CASH-${randomUUID()}` };
  }

  async refund(_input: ProviderRefundInput): Promise<ProviderRefundResult> {
    return { success: true, providerRefundId: `CASH-REFUND-${randomUUID()}` };
  }
}
