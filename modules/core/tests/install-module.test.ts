import { ModuleRegistry, type ModuleManifest } from "@erp/module-registry";
import { describe, expect, it, vi } from "vitest";
import { installModule } from "../src/application/install-module";
import {
  DependencyNotInstalledError,
  IncompatibleDependencyVersionError,
  ModuleAlreadyInstalledError,
} from "../src/domain/errors";
import { FakeModuleRegistryRepository } from "./fakes";

function manifest(
  id: string,
  dependsOn: { moduleId: string; versionRange: string }[] = [],
  applyMigrations?: ModuleManifest["applyMigrations"],
): ModuleManifest {
  return {
    id,
    name: id,
    version: "1.0.0",
    description: "",
    dependencies: dependsOn,
    permissions: [],
    routes: [],
    eventsPublished: [],
    eventsConsumed: [],
    configuration: [],
    ...(applyMigrations ? { applyMigrations } : {}),
  };
}

describe("installModule", () => {
  it("installs a module with no dependencies", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    const repository = new FakeModuleRegistryRepository();

    await installModule(registry, repository, "tenant-1", "core", "user-1");

    const record = await repository.findInstalled("tenant-1", "core");
    expect(record?.status).toBe("active");
    expect(record?.version).toBe("1.0.0");
  });

  it("rejects installing an already-active module", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    const repository = new FakeModuleRegistryRepository();
    await installModule(registry, repository, "tenant-1", "core", "user-1");

    await expect(installModule(registry, repository, "tenant-1", "core", "user-1")).rejects.toThrow(
      ModuleAlreadyInstalledError,
    );
  });

  it("rejects installing a module whose dependency isn't installed for this tenant", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    registry.register(manifest("identity", [{ moduleId: "core", versionRange: "*" }]));
    const repository = new FakeModuleRegistryRepository();

    await expect(installModule(registry, repository, "tenant-1", "identity", "user-1")).rejects.toThrow(
      DependencyNotInstalledError,
    );
  });

  it("succeeds once the dependency is installed first", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    registry.register(manifest("identity", [{ moduleId: "core", versionRange: "*" }]));
    const repository = new FakeModuleRegistryRepository();

    await installModule(registry, repository, "tenant-1", "core", "user-1");
    await installModule(registry, repository, "tenant-1", "identity", "user-1");

    const record = await repository.findInstalled("tenant-1", "identity");
    expect(record?.status).toBe("active");
  });

  it("rejects an incompatible dependency version", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    registry.register(manifest("identity", [{ moduleId: "core", versionRange: "2.0.0" }]));
    const repository = new FakeModuleRegistryRepository();

    await installModule(registry, repository, "tenant-1", "core", "user-1"); // installs core@1.0.0

    await expect(installModule(registry, repository, "tenant-1", "identity", "user-1")).rejects.toThrow(
      IncompatibleDependencyVersionError,
    );
  });

  it("does not leak across tenants — installing for tenant A never affects tenant B", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    const repository = new FakeModuleRegistryRepository();

    await installModule(registry, repository, "tenant-a", "core", "user-1");

    const recordForB = await repository.findInstalled("tenant-b", "core");
    expect(recordForB).toBeUndefined();
  });

  it("calls the manifest's applyMigrations for this tenant, when present (Phase 7)", async () => {
    const applyMigrations = vi.fn().mockResolvedValue(undefined);
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    registry.register(manifest("identity", [{ moduleId: "core", versionRange: "*" }], applyMigrations));
    const repository = new FakeModuleRegistryRepository();
    await installModule(registry, repository, "tenant-1", "core", "user-1");

    await installModule(registry, repository, "tenant-1", "identity", "user-1");

    expect(applyMigrations).toHaveBeenCalledTimes(1);
    expect(applyMigrations).toHaveBeenCalledWith("tenant-1");
  });

  it("never calls applyMigrations when a dependency isn't installed — migrations only run once install can actually proceed", async () => {
    const applyMigrations = vi.fn().mockResolvedValue(undefined);
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    registry.register(manifest("identity", [{ moduleId: "core", versionRange: "*" }], applyMigrations));
    const repository = new FakeModuleRegistryRepository();

    await expect(installModule(registry, repository, "tenant-1", "identity", "user-1")).rejects.toThrow(
      DependencyNotInstalledError,
    );
    expect(applyMigrations).not.toHaveBeenCalled();
  });

  it("does not call applyMigrations for a module that doesn't declare it (e.g. core/tenant)", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    const repository = new FakeModuleRegistryRepository();

    await expect(installModule(registry, repository, "tenant-1", "core", "user-1")).resolves.not.toThrow();
  });
});
