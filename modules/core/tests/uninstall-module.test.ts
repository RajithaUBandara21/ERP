import { ModuleRegistry } from "@erp/module-registry";
import { describe, expect, it } from "vitest";
import { installModule } from "../src/application/install-module";
import { uninstallModule } from "../src/application/uninstall-module";
import { ModuleHasDependentsError, ModuleNotInstalledError } from "../src/domain/errors";
import { FakeModuleRegistryRepository } from "./fakes";

function manifest(id: string, dependsOn: { moduleId: string; versionRange: string }[] = []) {
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
  };
}

describe("uninstallModule", () => {
  it("disables an installed module (never deletes the record)", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    const repository = new FakeModuleRegistryRepository();
    await installModule(registry, repository, "tenant-1", "core", "user-1");

    await uninstallModule(registry, repository, "tenant-1", "core", "user-1");

    const record = await repository.findInstalled("tenant-1", "core");
    expect(record?.status).toBe("disabled");
    expect(record).toBeDefined(); // still exists — not deleted
  });

  it("rejects uninstalling a module that isn't installed", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    const repository = new FakeModuleRegistryRepository();

    await expect(uninstallModule(registry, repository, "tenant-1", "core", "user-1")).rejects.toThrow(
      ModuleNotInstalledError,
    );
  });

  it("rejects uninstalling a module another active module depends on", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    registry.register(manifest("identity", [{ moduleId: "core", versionRange: "*" }]));
    const repository = new FakeModuleRegistryRepository();
    await installModule(registry, repository, "tenant-1", "core", "user-1");
    await installModule(registry, repository, "tenant-1", "identity", "user-1");

    await expect(uninstallModule(registry, repository, "tenant-1", "core", "user-1")).rejects.toThrow(
      ModuleHasDependentsError,
    );
  });

  it("allows uninstalling the dependency once the dependent is itself uninstalled", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    registry.register(manifest("identity", [{ moduleId: "core", versionRange: "*" }]));
    const repository = new FakeModuleRegistryRepository();
    await installModule(registry, repository, "tenant-1", "core", "user-1");
    await installModule(registry, repository, "tenant-1", "identity", "user-1");

    await uninstallModule(registry, repository, "tenant-1", "identity", "user-1");
    await expect(uninstallModule(registry, repository, "tenant-1", "core", "user-1")).resolves.not.toThrow();
  });

  it("a dependent disabled for tenant A does not block uninstalling the dependency for tenant B where it was never installed", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    registry.register(manifest("identity", [{ moduleId: "core", versionRange: "*" }]));
    const repository = new FakeModuleRegistryRepository();
    await installModule(registry, repository, "tenant-b", "core", "user-1");

    await expect(uninstallModule(registry, repository, "tenant-b", "core", "user-1")).resolves.not.toThrow();
  });
});
