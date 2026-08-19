import { coreManifest } from "@erp/core";
import { identityManifest } from "@erp/identity";
import { ModuleRegistry } from "@erp/module-registry";
import { posManifest } from "@erp/pos";
import { tenantManifest } from "@erp/tenant";

/**
 * The application's registered manifests — core, tenant, identity (always-
 * installed foundational modules) and pos (the first genuinely optional
 * business module — a tenant opts into it via POST /api/modules/pos/install,
 * it is NOT auto-installed by bootstrap-tenant.ts). validateGraph() runs
 * once here, at module load, not per-request.
 */
const registry = new ModuleRegistry();
registry.register(coreManifest);
registry.register(tenantManifest);
registry.register(identityManifest);
registry.register(posManifest);
registry.validateGraph();

export function getModuleRegistry(): ModuleRegistry {
  return registry;
}
