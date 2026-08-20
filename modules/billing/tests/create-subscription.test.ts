import { describe, expect, it } from "vitest";
import { seedDefaultPlans } from "../src/application/seed-default-plans";
import { createSubscription } from "../src/application/create-subscription";
import { PlanNotFoundError } from "../src/domain/plan";
import { FakePlanRepository, FakeSubscriptionRepository } from "./fakes";

describe("createSubscription", () => {
  it("subscribes a tenant to a plan by code, trialing by default", async () => {
    const planRepository = new FakePlanRepository();
    const subscriptionRepository = new FakeSubscriptionRepository();
    const { starter } = await seedDefaultPlans(planRepository);

    const subscription = await createSubscription({ planRepository, subscriptionRepository }, { tenantId: "tenant-1", planCode: "starter" });

    expect(subscription.tenantId).toBe("tenant-1");
    expect(subscription.planId).toBe(starter.id);
    expect(subscription.status).toBe("trialing");
  });

  it("is idempotent — a tenant that already has a subscription gets it back unchanged", async () => {
    const planRepository = new FakePlanRepository();
    const subscriptionRepository = new FakeSubscriptionRepository();
    await seedDefaultPlans(planRepository);

    const first = await createSubscription({ planRepository, subscriptionRepository }, { tenantId: "tenant-1", planCode: "starter" });
    const second = await createSubscription({ planRepository, subscriptionRepository }, { tenantId: "tenant-1", planCode: "growth" });

    expect(second.id).toBe(first.id);
    expect(second.planId).toBe(first.planId); // still starter — re-subscribing to a different plan does not silently switch it
  });

  it("throws PlanNotFoundError for an unknown plan code", async () => {
    const planRepository = new FakePlanRepository();
    const subscriptionRepository = new FakeSubscriptionRepository();

    await expect(
      createSubscription({ planRepository, subscriptionRepository }, { tenantId: "tenant-1", planCode: "nonexistent" }),
    ).rejects.toThrow(PlanNotFoundError);
  });
});
