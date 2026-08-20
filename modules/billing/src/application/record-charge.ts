import type { BillingCharge } from "../domain/billing-charge";
import type { BillingChargeRepository } from "./billing-charge-repository";
import type { PaymentGatewayPort } from "./payment-gateway-port";
import { getSubscriptionForTenant, type GetSubscriptionDependencies } from "./get-subscription-for-tenant";

export interface RecordChargeDependencies extends GetSubscriptionDependencies {
  billingChargeRepository: BillingChargeRepository;
  paymentGateway: PaymentGatewayPort;
}

/**
 * Charges a tenant its current plan's price and records the result — no
 * billing-cycle scheduler exists yet (CLAUDE.md §27), so this is triggered
 * manually (POST /api/billing/charge) until one does, the same "no
 * scheduler yet" precedent as packages/events' publishPendingEvents.
 * Never throws on a declined charge — the failure is recorded, not
 * propagated as an exception, so a bad charge never looks like a bug.
 */
export async function recordCharge(dependencies: RecordChargeDependencies, tenantId: string): Promise<BillingCharge> {
  const { plan } = await getSubscriptionForTenant(dependencies, tenantId);

  const charge = await dependencies.billingChargeRepository.create({
    tenantId,
    amountCents: plan.priceCents,
    currency: "USD",
  });

  const result = await dependencies.paymentGateway.charge({ tenantId, amountCents: plan.priceCents, currency: "USD" });
  if (result.success) {
    await dependencies.billingChargeRepository.markPaid(charge.id);
    return { ...charge, status: "paid", paidAt: new Date() };
  }

  await dependencies.billingChargeRepository.markFailed(charge.id);
  return { ...charge, status: "failed" };
}
