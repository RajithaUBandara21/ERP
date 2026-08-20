import { randomUUID } from "node:crypto";
import type { GatewayChargeInput, GatewayChargeResult, PaymentGatewayPort } from "../application/payment-gateway-port";

/**
 * Documented stand-in — no real gateway (Stripe or otherwise) is integrated
 * in this pass, the same precedent as modules/payments' SimulatedCardProvider.
 * Always succeeds; exists to prove the PaymentGatewayPort seam end to end
 * (record-charge.ts's paid/failed branching) without a live provider.
 */
export class StubPaymentGateway implements PaymentGatewayPort {
  async charge(_input: GatewayChargeInput): Promise<GatewayChargeResult> {
    return { success: true, providerReference: `STUB-${randomUUID()}` };
  }
}
