import { describe, expect, it } from "vitest";
import { seedDefaultPlans } from "../src/application/seed-default-plans";
import { createSubscription } from "../src/application/create-subscription";
import { recordCharge } from "../src/application/record-charge";
import { NoSubscriptionError } from "../src/domain/subscription";
import { FakeBillingChargeRepository, FakePaymentGateway, FakePlanRepository, FakeSubscriptionRepository } from "./fakes";

describe("recordCharge", () => {
  it("charges the tenant's plan price and marks the charge paid on success", async () => {
    const planRepository = new FakePlanRepository();
    const subscriptionRepository = new FakeSubscriptionRepository();
    const billingChargeRepository = new FakeBillingChargeRepository();
    const { starter } = await seedDefaultPlans(planRepository);
    await createSubscription({ planRepository, subscriptionRepository }, { tenantId: "tenant-1", planCode: "starter" });

    const charge = await recordCharge(
      { planRepository, subscriptionRepository, billingChargeRepository, paymentGateway: new FakePaymentGateway() },
      "tenant-1",
    );

    expect(charge.amountCents).toBe(starter.priceCents);
    expect(charge.status).toBe("paid");
    const [stored] = await billingChargeRepository.listForTenant("tenant-1");
    expect(stored?.status).toBe("paid");
  });

  it("marks the charge failed, not thrown, when the gateway declines", async () => {
    const planRepository = new FakePlanRepository();
    const subscriptionRepository = new FakeSubscriptionRepository();
    const billingChargeRepository = new FakeBillingChargeRepository();
    await seedDefaultPlans(planRepository);
    await createSubscription({ planRepository, subscriptionRepository }, { tenantId: "tenant-1", planCode: "starter" });

    const charge = await recordCharge(
      {
        planRepository,
        subscriptionRepository,
        billingChargeRepository,
        paymentGateway: new FakePaymentGateway({ success: false, providerReference: "FAKE-REF", failureReason: "insufficient_funds" }),
      },
      "tenant-1",
    );

    expect(charge.status).toBe("failed");
  });

  it("throws NoSubscriptionError for a tenant with no subscription", async () => {
    const planRepository = new FakePlanRepository();
    const subscriptionRepository = new FakeSubscriptionRepository();
    const billingChargeRepository = new FakeBillingChargeRepository();

    await expect(
      recordCharge(
        { planRepository, subscriptionRepository, billingChargeRepository, paymentGateway: new FakePaymentGateway() },
        "tenant-without-subscription",
      ),
    ).rejects.toThrow(NoSubscriptionError);
  });
});
