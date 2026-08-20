import type { ModuleManifest } from "@erp/module-registry";
import { applyCoreMigrations } from "./apply-migrations";
import { CORE_PERMISSIONS } from "./domain/permissions";

/**
 * core's own manifest — foundational, no dependencies. Owns no *business*
 * tenant-DB tables (a deliberate Phase 6 scope decision: the manifest/
 * registry *mechanism* was that phase's deliverable, exercised against a
 * module with nothing of its own to migrate — see docs/modules/core.md).
 * Phase 13 gives it a real applyMigrations for the first time — not for a
 * core-owned table, but to run the outbox/processed_events migration
 * (packages/events), since that needs to exist before any module might
 * want to publish an event, and core is the one module every tenant
 * always has active first. `routes`/`eventsPublished`/`eventsConsumed`/
 * `configuration` stay empty for the same reason those fields aren't
 * consumed by anything yet — see @erp/module-registry's types.ts.
 */
export const coreManifest: ModuleManifest = {
  id: "core",
  name: "Core Platform",
  version: "1.0.0",
  description: "Module registry, feature flags, configuration, audit logging — the foundational module every tenant has active.",
  dependencies: [],
  permissions: [
    { key: CORE_PERMISSIONS.MODULE_LIST, description: "List installed/available modules for a tenant" },
    { key: CORE_PERMISSIONS.MODULE_MANAGE, description: "Install or uninstall modules for a tenant" },
    { key: CORE_PERMISSIONS.EVENTS_PUBLISH, description: "Manually trigger the outbox publisher" },
  ],
  routes: [],
  eventsPublished: [],
  eventsConsumed: [],
  configuration: [],
  applyMigrations: applyCoreMigrations,
};
