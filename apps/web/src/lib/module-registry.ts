import { coreManifest } from "@erp/core";
import { deliveryManifest } from "@erp/delivery";
import { identityManifest } from "@erp/identity";
import { inventoryManifest } from "@erp/inventory";
import { ModuleRegistry } from "@erp/module-registry";
import { paymentsManifest } from "@erp/payments";
import { posManifest } from "@erp/pos";
import { reportingManifest } from "@erp/reporting";
import { tenantManifest } from "@erp/tenant";

/**
 * The application's registered manifests — core, tenant, identity (always-
 * installed foundational modules), inventory, payments, delivery,
 * reporting, and pos (opt-in business modules — a tenant installs them
 * explicitly via POST /api/modules/{inventory,payments,delivery,
 * reporting,pos}/install; none are auto-installed by
 * bootstrap-tenant.ts). pos depends on both inventory (Phase 9 retrofit)
 * and payments (Phase 10 retrofit — see modules/pos/src/module.manifest.ts);
 * delivery (Phase 11) and reporting (Phase 14) each depend only on
 * core/tenant/identity — delivery references orders by an opaque string
 * since no sales module exists, and reporting subscribes to other
 * modules' published events instead of taking a hard manifest dependency
 * on them (see modules/reporting/src/module.manifest.ts). validateGraph()
 * runs once here, at module load, not per-request.
 */
const registry = new ModuleRegistry();
registry.register(coreManifest);
registry.register(tenantManifest);
registry.register(identityManifest);
registry.register(inventoryManifest);
registry.register(paymentsManifest);
registry.register(posManifest);
registry.register(deliveryManifest);
registry.register(reportingManifest);
registry.validateGraph();

export function getModuleRegistry(): ModuleRegistry {
  return registry;
}
