import { describe, expect, it } from "vitest";
import { DuplicateModuleError, ModuleNotRegisteredError } from "../src/errors";
import { ModuleRegistry } from "../src/registry";
import { dummyManifest } from "./fixtures";

describe("ModuleRegistry", () => {
  it("registers and retrieves a manifest", () => {
    const registry = new ModuleRegistry();
    registry.register(dummyManifest("core"));

    expect(registry.get("core").id).toBe("core");
    expect(registry.has("core")).toBe(true);
  });

  it("rejects registering the same module id twice", () => {
    const registry = new ModuleRegistry();
    registry.register(dummyManifest("core"));

    expect(() => registry.register(dummyManifest("core"))).toThrow(DuplicateModuleError);
  });

  it("throws ModuleNotRegisteredError for an unknown module id", () => {
    const registry = new ModuleRegistry();
    expect(() => registry.get("missing")).toThrow(ModuleNotRegisteredError);
  });

  it("getAll returns every registered manifest", () => {
    const registry = new ModuleRegistry();
    registry.register(dummyManifest("core"));
    registry.register(dummyManifest("identity", ["core"]));

    expect(registry.getAll().map((m) => m.id).sort()).toEqual(["core", "identity"]);
  });
});
