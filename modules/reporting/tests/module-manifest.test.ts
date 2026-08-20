import { describe, expect, it } from "vitest";
import { reportingManifest } from "../src/module.manifest";
import { REPORTING_PERMISSIONS } from "../src/domain/permissions";

describe("reportingManifest", () => {
  it("depends only on core, tenant, and identity — no hard dependency on the modules it reports on", () => {
    const dependencyIds = reportingManifest.dependencies.map((d) => d.moduleId).sort();
    expect(dependencyIds).toEqual(["core", "identity", "tenant"]);
  });

  it("declares its permission catalog", () => {
    const keys = reportingManifest.permissions.map((p) => p.key);
    expect(keys).toContain(REPORTING_PERMISSIONS.SALES_READ);
  });

  it("wires applyMigrations to a real function", () => {
    expect(typeof reportingManifest.applyMigrations).toBe("function");
  });
});
