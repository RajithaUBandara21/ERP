import type { ModuleManifest } from "@erp/module-registry";
import { applyPosMigrations } from "./apply-migrations";
import { POS_PERMISSIONS } from "./domain/permissions";

/**
 * pos's manifest — Phase 8 built the "true foundation only" (confirmed
 * with the user before implementation, see ARCHITECTURE.md §9); Phase 9
 * retrofitted a real dependency on `inventory`; Phase 10 retrofits a real
 * dependency on `payments` too, exactly as this comment predicted.
 * checkout() now goes through real StockReservationPort and
 * PaymentCapturePort implementations (infrastructure/
 * inventory-stock-reservation-port.ts, infrastructure/
 * payments-capture-port.ts) instead of Phase 8's no-ops.
 *
 * DOMAIN-MODEL.md's full dependency graph also lists `sales`. Still
 * omitted here — it doesn't exist as a module yet, and nothing in `pos`
 * currently needs a customer/order concept beyond the cart it already
 * owns.
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
    { moduleId: "inventory", versionRange: "*" },
    { moduleId: "payments", versionRange: "*" },
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
