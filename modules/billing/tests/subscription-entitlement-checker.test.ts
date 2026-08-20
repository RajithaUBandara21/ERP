import { describe, expect, it } from "vitest";
import { seedDefaultPlans } from "../src/application/seed-default-plans";
import { createSubscription } from "../src/application/create-subscription";
import { SubscriptionEntitlementChecker } from "../src/application/subscription-entitlement-checker";
import { FakePlanRepository, FakeSubscriptionRepository } from "./fakes";

describe("SubscriptionEntitlementChecker", () => {
  it("entitles a module included in the tenant's plan", async () => {
    const planRepository = new FakePlanRepository();
    const subscriptionRepository = new FakeSubscriptionRepository();
    await seedDefaultPlans(planRepository);
    await createSubscription({ planRepository, subscriptionRepository }, { tenantId: "tenant-1", planCode: "starter" });

    const checker = new SubscriptionEntitlementChecker(subscriptionRepository, planRepository);
    expect(await checker.isModuleIncluded("tenant-1", "pos")).toBe(true);
  });

  it("denies a module not included in the tenant's plan", async () => {
    const planRepository = new FakePlanRepository();
    const subscriptionRepository = new FakeSubscriptionRepository();
    await seedDefaultPlans(planRepository);
    await createSubscription({ planRepository, subscriptionRepository }, { tenantId: "tenant-1", planCode: "starter" });

    const checker = new SubscriptionEntitlementChecker(subscriptionRepository, planRepository);
    expect(await checker.isModuleIncluded("tenant-1", "delivery")).toBe(false); // starter doesn't include delivery, growth does
  });

  it("denies everything for a tenant with no subscription at all (fail closed)", async () => {
    const planRepository = new FakePlanRepository();
    const subscriptionRepository = new FakeSubscriptionRepository();
    await seedDefaultPlans(planRepository);

    const checker = new SubscriptionEntitlementChecker(subscriptionRepository, planRepository);
    expect(await checker.isModuleIncluded("tenant-without-subscription", "pos")).toBe(false);
  });

  it("denies everything once the subscription is canceled", async () => {
    const planRepository = new FakePlanRepository();
    const subscriptionRepository = new FakeSubscriptionRepository();
    await seedDefaultPlans(planRepository);
    const subscription = await createSubscription(
      { planRepository, subscriptionRepository },
      { tenantId: "tenant-1", planCode: "starter" },
    );
    await subscriptionRepository.updateStatus(subscription.id, "canceled");

    const checker = new SubscriptionEntitlementChecker(subscriptionRepository, planRepository);
    expect(await checker.isModuleIncluded("tenant-1", "pos")).toBe(false);
  });
});
