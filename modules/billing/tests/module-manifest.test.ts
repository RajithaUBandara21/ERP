import { describe, expect, it } from "vitest";
import { billingManifest } from "../src/module.manifest";
import { BILLING_PERMISSIONS } from "../src/domain/permissions";

describe("billingManifest", () => {
  it("depends only on core", () => {
    const dependencyIds = billingManifest.dependencies.map((d) => d.moduleId);
    expect(dependencyIds).toEqual(["core"]);
  });

  it("declares its permission catalog", () => {
    const keys = billingManifest.permissions.map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining([BILLING_PERMISSIONS.SUBSCRIPTION_READ, BILLING_PERMISSIONS.CHARGE_RECORD]));
  });

  it("declares no tenant-DB migrations — plans/subscriptions/billing are control-plane data", () => {
    expect(billingManifest.applyMigrations).toBeUndefined();
  });
});
