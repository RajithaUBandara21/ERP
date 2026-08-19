import type { ModuleManifest } from "@erp/module-registry";

/**
 * tenant's manifest — retrofitted in Phase 7 (see ARCHITECTURE.md §9). No
 * tenant-DB migrations: this module's real tenant-DB tables (branches,
 * warehouses) don't exist yet (see docs/modules/tenant.md) — its lifecycle
 * (createTenant/provisionTenantDatabase/resolveTenantContext) operates on
 * the control-plane `tenants` table directly, not through this install
 * step. `applyMigrations` is omitted, same as core's manifest.
 */
export const tenantManifest: ModuleManifest = {
  id: "tenant",
  name: "Tenant System",
  version: "1.0.0",
  description: "Tenant lifecycle, resolution, and database provisioning.",
  dependencies: [{ moduleId: "core", versionRange: "*" }],
  permissions: [],
  routes: [],
  eventsPublished: [],
  eventsConsumed: [],
  configuration: [],
};
