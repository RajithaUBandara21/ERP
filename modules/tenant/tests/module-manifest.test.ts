import { describe, expect, it } from "vitest";
import { tenantManifest } from "../src/module.manifest";

describe("tenantManifest", () => {
  it("depends only on core", () => {
    expect(tenantManifest.dependencies).toEqual([{ moduleId: "core", versionRange: "*" }]);
  });

  it("declares no tenant-DB migrations (no tenant-DB schema exists yet)", () => {
    expect(tenantManifest.applyMigrations).toBeUndefined();
  });

  it("has a stable id matching what other manifests reference as a dependency", () => {
    expect(tenantManifest.id).toBe("tenant");
  });
});
