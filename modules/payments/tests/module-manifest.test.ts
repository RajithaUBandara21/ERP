import { describe, expect, it } from "vitest";
import { paymentsManifest } from "../src/module.manifest";
import { PAYMENTS_PERMISSIONS } from "../src/domain/permissions";

describe("paymentsManifest", () => {
  it("depends on core, tenant, and identity", () => {
    const dependencyIds = paymentsManifest.dependencies.map((d) => d.moduleId).sort();
    expect(dependencyIds).toEqual(["core", "identity", "tenant"]);
  });

  it("declares its permission catalog", () => {
    const keys = paymentsManifest.permissions.map((p) => p.key);
    expect(keys).toContain(PAYMENTS_PERMISSIONS.PAYMENT_CAPTURE);
    expect(keys).toContain(PAYMENTS_PERMISSIONS.PAYMENT_REFUND);
  });

  it("wires applyMigrations to a real function", () => {
    expect(typeof paymentsManifest.applyMigrations).toBe("function");
  });
});
