/** This module's permission catalog — see modules/identity/src/domain/permissions.ts for the same pattern and its doc comment on why this is a plain constant, not manifest-driven, until Phase 6's registry generalizes further. */
export const CORE_PERMISSIONS = {
  MODULE_LIST: "CORE.MODULE.LIST",
  MODULE_MANAGE: "CORE.MODULE.MANAGE",
} as const;

export type CorePermission = (typeof CORE_PERMISSIONS)[keyof typeof CORE_PERMISSIONS];
