import type { ModuleManifest } from "@erp/module-registry";
import { applyDeliveryMigrations } from "./apply-migrations";
import { DELIVERY_PERMISSIONS } from "./domain/permissions";

/**
 * delivery's manifest — Phase 11, "true foundation" (same pattern as
 * pos's Phase 8). docs/modules/delivery.md's original Phase 1 plan lists
 * a dependency on `sales` (for order/customer/address reference) — but
 * `sales` is not one of CLAUDE.md §54's 19 scheduled phases and doesn't
 * exist as a module. Rather than block on a module that may never be
 * built by name, `Delivery.orderReference` is a plain opaque string (see
 * domain/delivery.ts's doc comment) — the same "self-contained snapshot,
 * not a DB-enforced FK" choice modules/pos made for CartLine before any
 * product catalog existed. Depends only on core/tenant/identity, the same
 * always-installed baseline every business module declares.
 */
export const deliveryManifest: ModuleManifest = {
  id: "delivery",
  name: "Delivery",
  version: "1.0.0",
  description: "Deliveries, drivers, and assignments (see docs/modules/delivery.md).",
  dependencies: [
    { moduleId: "core", versionRange: "*" },
    { moduleId: "tenant", versionRange: "*" },
    { moduleId: "identity", versionRange: "*" },
  ],
  permissions: [
    { key: DELIVERY_PERMISSIONS.DRIVER_MANAGE, description: "Register/manage drivers" },
    { key: DELIVERY_PERMISSIONS.DELIVERY_CREATE, description: "Create deliveries" },
    { key: DELIVERY_PERMISSIONS.DELIVERY_ASSIGN, description: "Assign a driver to a delivery" },
    { key: DELIVERY_PERMISSIONS.DELIVERY_COMPLETE, description: "Mark a delivery completed" },
  ],
  routes: [],
  eventsPublished: [],
  eventsConsumed: [],
  configuration: [],
  applyMigrations: applyDeliveryMigrations,
};
