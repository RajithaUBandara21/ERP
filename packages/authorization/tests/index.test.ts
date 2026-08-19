import { describe, expect, it } from "vitest";
import { hasPermission, PermissionDeniedError, requirePermission } from "../src/index";

describe("hasPermission", () => {
  it("returns true for an exact match", () => {
    expect(hasPermission(["IDENTITY.USER.LIST"], "IDENTITY.USER.LIST")).toBe(true);
  });

  it("returns false when the permission is not granted", () => {
    expect(hasPermission(["IDENTITY.USER.LIST"], "IDENTITY.ROLE.MANAGE")).toBe(false);
  });

  it("returns false for an empty grant set (default-deny)", () => {
    expect(hasPermission([], "IDENTITY.USER.LIST")).toBe(false);
  });

  it("the wildcard grants any permission", () => {
    expect(hasPermission(["*"], "ANYTHING.AT.ALL")).toBe(true);
  });

  it("does not treat a wildcard as a literal substring match", () => {
    expect(hasPermission(["IDENTITY.USER.*"], "IDENTITY.USER.LIST")).toBe(false);
  });
});

describe("requirePermission", () => {
  it("does not throw when the permission is granted", () => {
    expect(() => requirePermission(["IDENTITY.USER.LIST"], "IDENTITY.USER.LIST")).not.toThrow();
  });

  it("throws PermissionDeniedError when the permission is missing", () => {
    expect(() => requirePermission([], "IDENTITY.USER.LIST")).toThrow(PermissionDeniedError);
  });

  it("the thrown error carries the required permission for logging/audit", () => {
    try {
      requirePermission([], "IDENTITY.USER.LIST");
      expect.fail("expected requirePermission to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect((error as PermissionDeniedError).permission).toBe("IDENTITY.USER.LIST");
    }
  });
});
