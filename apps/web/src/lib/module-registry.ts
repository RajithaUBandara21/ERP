import { billingManifest } from "@erp/billing";
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
 * The application's registered manifests — core, tenant, identity, billing
 * (always-installed foundational modules — billing Phase 15), inventory,
 * payments, delivery, reporting, and pos (opt-in business modules — a
 * tenant installs them explicitly via POST /api/modules/{inventory,
 * payments,delivery,reporting,pos}/install; none are auto-installed by
 * bootstrap-tenant.ts, though billing gates install-route so a tenant can
 * only opt into a module its subscribed plan actually includes — see
 * src/app/api/modules/[moduleId]/install/route.ts). pos depends on both
 * inventory (Phase 9 retrofit) and payments (Phase 10 retrofit — see
 * modules/pos/src/module.manifest.ts); delivery (Phase 11), reporting
 * (Phase 14), and billing (Phase 15) each depend only on core — delivery
 * references orders by an opaque string since no sales module exists,
 * reporting subscribes to other modules' published events instead of
 * taking a hard manifest dependency on them (see
 * modules/reporting/src/module.manifest.ts), and billing's plans/
 * subscriptions are control-plane data with no tenant-DB migrations (see
 * modules/billing/src/module.manifest.ts). validateGraph() runs once
 * here, at module load, not per-request.
 */
const registry = new ModuleRegistry();
registry.register(coreManifest);
registry.register(tenantManifest);
registry.register(identityManifest);
registry.register(billingManifest);
registry.register(inventoryManifest);
registry.register(paymentsManifest);
registry.register(posManifest);
registry.register(deliveryManifest);
registry.register(reportingManifest);
registry.validateGraph();

export function getModuleRegistry(): ModuleRegistry {
  return registry;
}
