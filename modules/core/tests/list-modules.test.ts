import { ModuleRegistry } from "@erp/module-registry";
import { describe, expect, it } from "vitest";
import { installModule } from "../src/application/install-module";
import { listModules } from "../src/application/list-modules";
import { FakeModuleRegistryRepository } from "./fakes";

function manifest(id: string) {
  return {
    id,
    name: id,
    version: "1.0.0",
    description: "",
    dependencies: [],
    permissions: [],
    routes: [],
    eventsPublished: [],
    eventsConsumed: [],
    configuration: [],
  };
}

describe("listModules", () => {
  it("reports every registered module, marking uninstalled ones as not_installed", async () => {
    const registry = new ModuleRegistry();
    registry.register(manifest("core"));
    registry.register(manifest("identity"));
    const repository = new FakeModuleRegistryRepository();
    await installModule(registry, repository, "tenant-1", "core", "user-1");

    const listing = await listModules(registry, repository, "tenant-1");
    const byId = Object.fromEntries(listing.map((entry) => [entry.manifest.id, entry]));

    expect(byId["core"]?.status).toBe("active");
    expect(byId["core"]?.version).toBe("1.0.0");
    expect(byId["identity"]?.status).toBe("not_installed");
    expect(byId["identity"]?.version).toBeNull();
  });
});
