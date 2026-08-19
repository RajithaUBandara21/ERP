import { coreManifest } from "@erp/core";
import { identityManifest } from "@erp/identity";
import { ModuleRegistry } from "@erp/module-registry";
import { tenantManifest } from "@erp/tenant";

/**
 * The application's registered manifests — core, tenant, and identity are
 * the always-installed foundational modules. validateGraph() runs once
 * here, at module load, not per-request.
 */
const registry = new ModuleRegistry();
registry.register(coreManifest);
registry.register(tenantManifest);
registry.register(identityManifest);
registry.validateGraph();

export function getModuleRegistry(): ModuleRegistry {
  return registry;
}
