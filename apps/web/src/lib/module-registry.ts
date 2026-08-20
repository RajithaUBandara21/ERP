import { coreManifest } from "@erp/core";
import { identityManifest } from "@erp/identity";
import { inventoryManifest } from "@erp/inventory";
import { ModuleRegistry } from "@erp/module-registry";
import { paymentsManifest } from "@erp/payments";
import { posManifest } from "@erp/pos";
import { tenantManifest } from "@erp/tenant";

/**
 * The application's registered manifests — core, tenant, identity (always-
 * installed foundational modules), inventory, payments, and pos (opt-in
 * business modules — a tenant installs them explicitly via POST /api/
 * modules/{inventory,payments,pos}/install; none are auto-installed by
 * bootstrap-tenant.ts). pos depends on both inventory (Phase 9 retrofit)
 * and payments (Phase 10 retrofit — see modules/pos/src/module.manifest.ts),
 * so a tenant must install both before pos. validateGraph() runs once
 * here, at module load, not per-request.
 */
const registry = new ModuleRegistry();
registry.register(coreManifest);
registry.register(tenantManifest);
registry.register(identityManifest);
registry.register(inventoryManifest);
registry.register(paymentsManifest);
registry.register(posManifest);
registry.validateGraph();

export function getModuleRegistry(): ModuleRegistry {
  return registry;
}
