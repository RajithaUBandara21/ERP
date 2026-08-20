/** This module's permission catalog — see modules/identity/src/domain/permissions.ts for the same pattern and its doc comment on why this is a plain constant, not manifest-driven, until Phase 6's registry generalizes further. */
export const CORE_PERMISSIONS = {
  MODULE_LIST: "CORE.MODULE.LIST",
  MODULE_MANAGE: "CORE.MODULE.MANAGE",
  /** Triggers the outbox publisher on demand — no background job scheduler exists yet (CLAUDE.md §27), so this is the only way to drain it until one does. */
  EVENTS_PUBLISH: "CORE.EVENTS.PUBLISH",
} as const;

export type CorePermission = (typeof CORE_PERMISSIONS)[keyof typeof CORE_PERMISSIONS];
