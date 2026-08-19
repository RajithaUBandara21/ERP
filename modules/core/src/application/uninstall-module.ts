import { recordAuditEvent } from "@erp/logging";
import type { ModuleRegistry } from "@erp/module-registry";
import { ModuleHasDependentsError, ModuleNotInstalledError } from "../domain/errors";
import type { ModuleRegistryRepository } from "./module-registry-repository";

/** MODULE-SYSTEM.md §6's sequence, applied to one tenant. Never deletes data — only disables. */
export async function uninstallModule(
  registry: ModuleRegistry,
  repository: ModuleRegistryRepository,
  tenantId: string,
  moduleId: string,
  actor: string | null,
): Promise<void> {
  registry.get(moduleId); // throws ModuleNotRegisteredError if unknown to the registry

  const existing = await repository.findInstalled(tenantId, moduleId);
  if (!existing || existing.status !== "active") {
    throw new ModuleNotInstalledError(moduleId);
  }

  // Validate dependent modules: refuse if another module this tenant has
  // ACTIVE declares this one as a dependency.
  const dependents: string[] = [];
  for (const candidate of registry.getAll()) {
    if (candidate.id === moduleId) continue;
    if (!candidate.dependencies.some((dependency) => dependency.moduleId === moduleId)) continue;

    const candidateInstalled = await repository.findInstalled(tenantId, candidate.id);
    if (candidateInstalled?.status === "active") {
      dependents.push(candidate.id);
    }
  }
  if (dependents.length > 0) {
    throw new ModuleHasDependentsError(moduleId, dependents);
  }

  // Disable + preserve data — never delete (MODULE-SYSTEM.md §6).
  await repository.disable(tenantId, moduleId);

  recordAuditEvent({
    module: "core",
    actor,
    tenantId,
    action: "module.uninstall",
    resource: "module",
    resourceId: moduleId,
  });
}
