import { describe, expect, it } from "vitest";
import { identityManifest } from "../src/module.manifest";
import { IDENTITY_PERMISSIONS } from "../src/domain/permissions";

describe("identityManifest", () => {
  it("depends only on core", () => {
    expect(identityManifest.dependencies).toEqual([{ moduleId: "core", versionRange: "*" }]);
  });

  it("declares its permission catalog", () => {
    const keys = identityManifest.permissions.map((p) => p.key);
    expect(keys).toContain(IDENTITY_PERMISSIONS.USER_LIST);
    expect(keys).toContain(IDENTITY_PERMISSIONS.ROLE_MANAGE);
  });

  it("wires applyMigrations to a real function (this module owns real tenant-DB tables)", () => {
    expect(typeof identityManifest.applyMigrations).toBe("function");
  });

  it("has a stable id matching what other manifests would reference as a dependency", () => {
    expect(identityManifest.id).toBe("identity");
  });
});
