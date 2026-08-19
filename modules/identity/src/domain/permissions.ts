/**
 * This module's permission catalog — see MODULE-SYSTEM.md §2's
 * ModuleManifest.permissions. Declared as a plain constant, not registered
 * dynamically, because the module manifest/registry system that would do
 * that doesn't exist until Phase 6 — this is the Phase 5 stand-in, same
 * pattern as identity/apply-migrations.ts standing in for Phase 6's
 * migration-installation step. Grows as this module grows; other modules
 * will declare their own catalogs the same way once implemented.
 */
export const IDENTITY_PERMISSIONS = {
  USER_LIST: "IDENTITY.USER.LIST",
  ROLE_MANAGE: "IDENTITY.ROLE.MANAGE",
} as const;

export type IdentityPermission = (typeof IDENTITY_PERMISSIONS)[keyof typeof IDENTITY_PERMISSIONS];
