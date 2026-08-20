import type { ModuleManifest } from "@erp/module-registry";
import { applyReportingMigrations } from "./apply-migrations";
import { REPORTING_PERMISSIONS } from "./domain/permissions";

/**
 * reporting's manifest — Phase 14, "true foundation" (same pattern as
 * pos's Phase 8). docs/modules/reporting.md's original plan deliberately
 * gives reporting no hard manifest dependency on the modules it reports
 * on (only core/tenant/identity, the always-installed baseline) — it
 * subscribes to their published events instead, so adding a new
 * reportable module never means reporting needs a new dependency. See
 * application/order-paid-report-consumer.ts.
 */
export const reportingManifest: ModuleManifest = {
  id: "reporting",
  name: "Reporting",
  version: "1.0.0",
  description: "Read-optimized aggregates built from other modules' domain events (see docs/modules/reporting.md).",
  dependencies: [
    { moduleId: "core", versionRange: "*" },
    { moduleId: "tenant", versionRange: "*" },
    { moduleId: "identity", versionRange: "*" },
  ],
  permissions: [{ key: REPORTING_PERMISSIONS.SALES_READ, description: "Read the sales summary report" }],
  routes: [],
  eventsPublished: [],
  eventsConsumed: [],
  configuration: [],
  applyMigrations: applyReportingMigrations,
};
