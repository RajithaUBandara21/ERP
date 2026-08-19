/**
 * The Phase 6 exit criterion: a deliberately circular dummy-manifest
 * dependency is caught by the validator.
 */
import { describe, expect, it } from "vitest";
import { CircularDependencyError, UnknownDependencyError } from "../src/errors";
import { ModuleRegistry } from "../src/registry";
import { dummyManifest } from "./fixtures";

describe("ModuleRegistry.validateGraph", () => {
  it("passes for a valid acyclic graph", () => {
    const registry = new ModuleRegistry();
    registry.register(dummyManifest("core"));
    registry.register(dummyManifest("tenant", ["core"]));
    registry.register(dummyManifest("identity", ["core"]));
    registry.register(dummyManifest("pos", ["core", "tenant", "identity"]));

    expect(() => registry.validateGraph()).not.toThrow();
  });

  it("catches a direct two-module cycle (A → B → A)", () => {
    const registry = new ModuleRegistry();
    registry.register(dummyManifest("moduleA", ["moduleB"]));
    registry.register(dummyManifest("moduleB", ["moduleA"]));

    expect(() => registry.validateGraph()).toThrow(CircularDependencyError);
  });

  it("catches an indirect three-module cycle (A → B → C → A)", () => {
    const registry = new ModuleRegistry();
    registry.register(dummyManifest("moduleA", ["moduleB"]));
    registry.register(dummyManifest("moduleB", ["moduleC"]));
    registry.register(dummyManifest("moduleC", ["moduleA"]));

    expect(() => registry.validateGraph()).toThrow(CircularDependencyError);
  });

  it("a module depending on itself is a cycle", () => {
    const registry = new ModuleRegistry();
    registry.register(dummyManifest("moduleA", ["moduleA"]));

    expect(() => registry.validateGraph()).toThrow(CircularDependencyError);
  });

  it("throws UnknownDependencyError for a dependency that was never registered", () => {
    const registry = new ModuleRegistry();
    registry.register(dummyManifest("pos", ["nonexistent-module"]));

    expect(() => registry.validateGraph()).toThrow(UnknownDependencyError);
  });
});
