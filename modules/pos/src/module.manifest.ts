import type { ModuleManifest } from "@erp/module-registry";
import { applyPosMigrations } from "./apply-migrations";
import { POS_PERMISSIONS } from "./domain/permissions";

/**
 * pos's manifest — Phase 8, "true foundation only" (confirmed with the
 * user before implementation, see ARCHITECTURE.md §9).
 *
 * DOMAIN-MODEL.md's full dependency graph lists pos depending on core,
 * tenant, identity, sales, inventory, and payments. Only core/tenant/
 * identity are declared here: a manifest dependency must resolve to
 * another REGISTERED manifest (ModuleRegistry.validateGraph() enforces
 * this), and sales/inventory/payments don't exist as modules yet. Adding
 * them is a one-line change to `dependencies` once each module lands
 * (Phase 9/10), at which point installing pos will correctly start
 * requiring them too — the same retrofit pattern Phase 7 used for
 * identity/tenant. Until then, checkout()'s calls to those systems go
 * through stubbed ports (see application/stock-reservation-port.ts,
 * application/payment-capture-port.ts), not a manifest dependency.
 */
export const posManifest: ModuleManifest = {
  id: "pos",
  name: "Point of Sale",
  version: "1.0.0",
  description: "POS transactions, carts, receipts, terminals (foundation — see docs/modules/pos.md).",
  dependencies: [
    { moduleId: "core", versionRange: "*" },
    { moduleId: "tenant", versionRange: "*" },
    { moduleId: "identity", versionRange: "*" },
  ],
  permissions: [
    { key: POS_PERMISSIONS.TERMINAL_MANAGE, description: "Register/manage POS terminals" },
    { key: POS_PERMISSIONS.ORDER_CREATE, description: "Create POS orders (checkout)" },
    { key: POS_PERMISSIONS.ORDER_REFUND, description: "Refund POS orders (not yet implemented)" },
  ],
  routes: [],
  eventsPublished: [],
  eventsConsumed: [],
  configuration: [],
  applyMigrations: applyPosMigrations,
};
