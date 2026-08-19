import type { ModuleManifest, ModuleRegistry } from "@erp/module-registry";
import type { ModuleRegistryRepository } from "./module-registry-repository";

export interface ModuleListing {
  manifest: ModuleManifest;
  status: "active" | "disabled" | "not_installed";
  version: string | null;
}

export async function listModules(
  registry: ModuleRegistry,
  repository: ModuleRegistryRepository,
  tenantId: string,
): Promise<ModuleListing[]> {
  const installed = await repository.listInstalled(tenantId);
  const installedById = new Map(installed.map((record) => [record.moduleId, record]));

  return registry.getAll().map((manifest) => {
    const record = installedById.get(manifest.id);
    return {
      manifest,
      status: record?.status ?? "not_installed",
      version: record?.version ?? null,
    };
  });
}
