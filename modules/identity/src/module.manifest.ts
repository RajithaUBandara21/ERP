import type { ModuleManifest } from "@erp/module-registry";
import { applyIdentityMigrations } from "./apply-migrations";
import { IDENTITY_PERMISSIONS } from "./domain/permissions";

/**
 * identity's manifest — retrofitted in Phase 7 (see ARCHITECTURE.md §9).
 * `applyMigrations` wires this module's real tenant-DB schema (the
 * users/roles tables) into modules/core's installModule step 3 — the first
 * module for which that hook does real work.
 */
export const identityManifest: ModuleManifest = {
  id: "identity",
  name: "Identity",
  version: "1.0.0",
  description: "Tenant-scoped users, credentials, roles, and permissions.",
  dependencies: [{ moduleId: "core", versionRange: "*" }],
  permissions: [
    { key: IDENTITY_PERMISSIONS.USER_LIST, description: "List users in this tenant" },
    { key: IDENTITY_PERMISSIONS.ROLE_MANAGE, description: "Manage roles in this tenant" },
  ],
  routes: [],
  eventsPublished: [],
  eventsConsumed: [],
  configuration: [],
  applyMigrations: applyIdentityMigrations,
};
