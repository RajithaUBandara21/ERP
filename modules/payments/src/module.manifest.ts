import type { ModuleManifest } from "@erp/module-registry";
import { applyPaymentsMigrations } from "./apply-migrations";
import { PAYMENTS_PERMISSIONS } from "./domain/permissions";

/**
 * payments's manifest — Phase 10. Depends on core, tenant, identity: the
 * same always-installed foundational baseline every business module
 * declares (see modules/pos's and modules/inventory's manifest comments).
 */
export const paymentsManifest: ModuleManifest = {
  id: "payments",
  name: "Payments",
  version: "1.0.0",
  description: "Payment capture, refunds, and the provider abstraction (see docs/modules/payments.md).",
  dependencies: [
    { moduleId: "core", versionRange: "*" },
    { moduleId: "tenant", versionRange: "*" },
    { moduleId: "identity", versionRange: "*" },
  ],
  permissions: [
    { key: PAYMENTS_PERMISSIONS.PAYMENT_CAPTURE, description: "Capture payments" },
    { key: PAYMENTS_PERMISSIONS.PAYMENT_REFUND, description: "Refund payments" },
    { key: PAYMENTS_PERMISSIONS.PAYMENT_READ, description: "Read payment attempts" },
  ],
  routes: [],
  eventsPublished: [],
  eventsConsumed: [],
  configuration: [],
  applyMigrations: applyPaymentsMigrations,
};
