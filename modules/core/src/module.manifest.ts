import type { ModuleManifest } from "@erp/module-registry";
import { CORE_PERMISSIONS } from "./domain/permissions";

/**
 * core's own manifest — foundational, no dependencies. Owns no tenant-DB
 * tables yet (a deliberate Phase 6 scope decision: the manifest/registry
 * *mechanism* is this phase's deliverable, exercised against a module with
 * nothing to migrate — see docs/modules/core.md). `routes`/`events*`/
 * `configuration` are declared empty for the same reason those fields
 * aren't consumed by anything yet — see @erp/module-registry's types.ts.
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
  ],
  routes: [],
  eventsPublished: [],
  eventsConsumed: [],
  configuration: [],
};
