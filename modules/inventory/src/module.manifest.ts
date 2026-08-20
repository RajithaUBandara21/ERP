import type { ModuleManifest } from "@erp/module-registry";
import { applyInventoryMigrations } from "./apply-migrations";
import { INVENTORY_PERMISSIONS } from "./domain/permissions";

/**
 * inventory's manifest — Phase 9. Depends on core, tenant, identity: the
 * same always-installed foundational baseline every business module
 * declares (see modules/pos/src/module.manifest.ts's comment) — not just
 * core/tenant as docs/modules/inventory.md's original Phase 1 plan listed,
 * since permission-gated routes require identity regardless of whether
 * inventory's own tables reference it. docs/modules/inventory.md is
 * updated to note this refinement.
 */
export const inventoryManifest: ModuleManifest = {
  id: "inventory",
  name: "Inventory",
  version: "1.0.0",
  description: "Warehouses, stock levels, and the stock movement ledger (see docs/modules/inventory.md).",
  dependencies: [
    { moduleId: "core", versionRange: "*" },
    { moduleId: "tenant", versionRange: "*" },
    { moduleId: "identity", versionRange: "*" },
  ],
  permissions: [
    { key: INVENTORY_PERMISSIONS.WAREHOUSE_MANAGE, description: "Create/manage warehouses" },
    { key: INVENTORY_PERMISSIONS.STOCK_READ, description: "Read stock levels" },
    { key: INVENTORY_PERMISSIONS.STOCK_RECEIVE, description: "Record stock receipts" },
    { key: INVENTORY_PERMISSIONS.STOCK_ADJUST, description: "Record manual stock adjustments" },
    { key: INVENTORY_PERMISSIONS.STOCK_TRANSFER, description: "Transfer stock between warehouses (not yet implemented)" },
  ],
  routes: [],
  eventsPublished: [],
  eventsConsumed: [],
  configuration: [],
  applyMigrations: applyInventoryMigrations,
};
