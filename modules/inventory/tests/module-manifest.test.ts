import { describe, expect, it } from "vitest";
import { inventoryManifest } from "../src/module.manifest";
import { INVENTORY_PERMISSIONS } from "../src/domain/permissions";

describe("inventoryManifest", () => {
  it("depends on core, tenant, and identity", () => {
    const dependencyIds = inventoryManifest.dependencies.map((d) => d.moduleId).sort();
    expect(dependencyIds).toEqual(["core", "identity", "tenant"]);
  });

  it("declares its permission catalog", () => {
    const keys = inventoryManifest.permissions.map((p) => p.key);
    expect(keys).toContain(INVENTORY_PERMISSIONS.STOCK_READ);
    expect(keys).toContain(INVENTORY_PERMISSIONS.STOCK_ADJUST);
    expect(keys).toContain(INVENTORY_PERMISSIONS.STOCK_TRANSFER);
  });

  it("wires applyMigrations to a real function", () => {
    expect(typeof inventoryManifest.applyMigrations).toBe("function");
  });
});
