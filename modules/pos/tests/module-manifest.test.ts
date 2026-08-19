import { describe, expect, it } from "vitest";
import { posManifest } from "../src/module.manifest";
import { POS_PERMISSIONS } from "../src/domain/permissions";

describe("posManifest", () => {
  it("depends on core, tenant, and identity (sales/inventory/payments omitted — see doc comment)", () => {
    const dependencyIds = posManifest.dependencies.map((d) => d.moduleId).sort();
    expect(dependencyIds).toEqual(["core", "identity", "tenant"]);
  });

  it("declares its permission catalog", () => {
    const keys = posManifest.permissions.map((p) => p.key);
    expect(keys).toContain(POS_PERMISSIONS.ORDER_CREATE);
    expect(keys).toContain(POS_PERMISSIONS.TERMINAL_MANAGE);
  });

  it("wires applyMigrations to a real function", () => {
    expect(typeof posManifest.applyMigrations).toBe("function");
  });
});
