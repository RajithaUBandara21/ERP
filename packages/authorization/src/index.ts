/**
 * Pure RBAC evaluation — no database, no framework dependency. Given the
 * set of permission strings a role grants, answers "is this one of them."
 * How those permission strings are loaded (session → user → role →
 * permissions) is the caller's job — see apps/web's withPermission for the
 * Next.js composition. See ADR-0007 for the full model.
 *
 * Branch/warehouse-scoped grants are NOT implemented yet — Branch/Warehouse
 * entities don't exist until Phase 6+ (see docs/modules/tenant.md). This
 * module's functions accept only a flat permission string for now; a scope
 * parameter can be added later without an API break for callers that don't
 * need it (this was an explicit Phase 5 scope decision, not an oversight).
 */

export class PermissionDeniedError extends Error {
  constructor(public readonly permission: string) {
    super(`Permission denied: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

/** The wildcard permission a role can hold to mean "every permission" (used by the seeded Owner role). */
export const WILDCARD_PERMISSION = "*";

export function hasPermission(grantedPermissions: readonly string[], required: string): boolean {
  return grantedPermissions.includes(WILDCARD_PERMISSION) || grantedPermissions.includes(required);
}

/** Default-deny: throws unless `required` is explicitly granted (or the wildcard is present). */
export function requirePermission(grantedPermissions: readonly string[], required: string): void {
  if (!hasPermission(grantedPermissions, required)) {
    throw new PermissionDeniedError(required);
  }
}
