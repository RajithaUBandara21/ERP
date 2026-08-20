/**
 * The platform-level payment-gateway seam — CLAUDE.md §33's PaymentService
 * abstraction, applied to charging tenants for their subscription rather
 * than capturing a POS sale (modules/payments' PaymentProvider is the
 * tenant-facing equivalent; this is the platform's own, for billing
 * tenants, not the same abstraction reused — the two never mix, since a
 * tenant's own payment providers must never be reachable from platform
 * billing code, and vice versa). No real gateway is integrated in this
 * pass — see infrastructure/stub-payment-gateway.ts, the same documented
 * stand-in precedent as modules/payments' SimulatedCardProvider.
 */
export interface GatewayChargeInput {
  tenantId: string;
  amountCents: number;
  currency: string;
}

export interface GatewayChargeResult {
  success: boolean;
  providerReference: string;
  failureReason?: string;
}

export interface PaymentGatewayPort {
  charge(input: GatewayChargeInput): Promise<GatewayChargeResult>;
}
