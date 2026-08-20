import { describe, expect, it } from "vitest";
import { seedDefaultPlans } from "../src/application/seed-default-plans";
import { FakePlanRepository } from "./fakes";

describe("seedDefaultPlans", () => {
  it("creates starter and growth plans including the always-on foundational modules", async () => {
    const repository = new FakePlanRepository();
    const { starter, growth } = await seedDefaultPlans(repository);

    expect(starter.includedModules).toEqual(expect.arrayContaining(["core", "tenant", "identity", "pos", "inventory", "payments"]));
    expect(growth.includedModules).toEqual(
      expect.arrayContaining(["core", "tenant", "identity", "pos", "inventory", "payments", "delivery", "reporting"]),
    );
  });

  it("is idempotent — re-seeding upserts by code rather than duplicating", async () => {
    const repository = new FakePlanRepository();
    await seedDefaultPlans(repository);
    await seedDefaultPlans(repository);

    const plans = await repository.list();
    expect(plans).toHaveLength(2);
  });
});
