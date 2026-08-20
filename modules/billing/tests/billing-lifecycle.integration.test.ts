/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 * No tenant database is provisioned — billing is control-plane-only
 * (module.manifest.ts's doc comment) — but subscriptions.tenant_id is a
 * real FK into the control-plane tenants table, so a tenant row must exist.
 */
import { afterAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository } from "@erp/tenant";
import { seedDefaultPlans } from "../src/application/seed-default-plans";
import { createSubscription } from "../src/application/create-subscription";
import { getSubscriptionForTenant } from "../src/application/get-subscription-for-tenant";
import { recordCharge } from "../src/application/record-charge";
import { SubscriptionEntitlementChecker } from "../src/application/subscription-entitlement-checker";
import { DrizzlePlanRepository } from "../src/infrastructure/drizzle-plan-repository";
import { DrizzleSubscriptionRepository } from "../src/infrastructure/drizzle-subscription-repository";
import { DrizzleBillingChargeRepository } from "../src/infrastructure/drizzle-billing-charge-repository";
import { StubPaymentGateway } from "../src/infrastructure/stub-payment-gateway";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("billing lifecycle (integration)", () => {
  const slug = `billing-test-${Date.now()}`;
  const planRepository = new DrizzlePlanRepository();
  const subscriptionRepository = new DrizzleSubscriptionRepository();
  const billingChargeRepository = new DrizzleBillingChargeRepository();

  afterAll(async () => {
    await closeControlPlaneDb();
  });

  it("seeds plans, subscribes a real tenant, gates entitlement, and records a charge — all against real tables", async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Billing Test Tenant" });

    const { starter } = await seedDefaultPlans(planRepository);

    const subscription = await createSubscription({ planRepository, subscriptionRepository }, { tenantId: tenant.id, planCode: "starter" });
    expect(subscription.planId).toBe(starter.id);
    expect(subscription.status).toBe("trialing");

    // Idempotent — calling again for the same tenant does not create a second row (enforced by the real unique index).
    const again = await createSubscription({ planRepository, subscriptionRepository }, { tenantId: tenant.id, planCode: "starter" });
    expect(again.id).toBe(subscription.id);

    const { plan } = await getSubscriptionForTenant({ planRepository, subscriptionRepository }, tenant.id);
    expect(plan.code).toBe("starter");

    const checker = new SubscriptionEntitlementChecker(subscriptionRepository, planRepository);
    expect(await checker.isModuleIncluded(tenant.id, "pos")).toBe(true);
    expect(await checker.isModuleIncluded(tenant.id, "delivery")).toBe(false);

    const charge = await recordCharge(
      { planRepository, subscriptionRepository, billingChargeRepository, paymentGateway: new StubPaymentGateway() },
      tenant.id,
    );
    expect(charge.status).toBe("paid");
    expect(charge.amountCents).toBe(starter.priceCents);

    const charges = await billingChargeRepository.listForTenant(tenant.id);
    expect(charges).toHaveLength(1);
  });
});
