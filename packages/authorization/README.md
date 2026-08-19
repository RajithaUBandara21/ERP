# packages/authorization

`requirePermission()` guard and RBAC evaluation — pure, no database/framework dependency (see [ADR-0007](../../docs/adr/0007-authorization.md)).

- `hasPermission(grantedPermissions, required)` / `requirePermission(grantedPermissions, required)` — exact match or the `"*"` wildcard; default-deny.
- `PermissionDeniedError` — thrown by `requirePermission`, carries the required permission for logging.

Branch/warehouse-scoped grants are **not implemented yet** — see this package's `src/index.ts` doc comment and [ADR-0007](../../docs/adr/0007-authorization.md)'s Update for why, and how the signature stays ready for it. Consumed by `modules/identity` (loads a user's role permissions) and composed into `apps/web`'s `withPermission()`.
