import { describe, expect, it } from "vitest";
import { deliveryManifest } from "../src/module.manifest";
import { DELIVERY_PERMISSIONS } from "../src/domain/permissions";

describe("deliveryManifest", () => {
  it("depends on core, tenant, and identity (sales omitted — see doc comment)", () => {
    const dependencyIds = deliveryManifest.dependencies.map((d) => d.moduleId).sort();
    expect(dependencyIds).toEqual(["core", "identity", "tenant"]);
  });

  it("declares its permission catalog", () => {
    const keys = deliveryManifest.permissions.map((p) => p.key);
    expect(keys).toContain(DELIVERY_PERMISSIONS.DELIVERY_ASSIGN);
    expect(keys).toContain(DELIVERY_PERMISSIONS.DELIVERY_COMPLETE);
  });

  it("wires applyMigrations to a real function", () => {
    expect(typeof deliveryManifest.applyMigrations).toBe("function");
  });
});
