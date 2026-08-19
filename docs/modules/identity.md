# Module: identity

Status: users, credential verification, and roles/permissions implemented as of Phase 5 (`modules/identity`); retrofitted with a real `module.manifest.ts` in Phase 7, including a working `applyMigrations` hook — this module's tables are now created purely by installing it through `modules/core`'s registry (proven in `apps/web/tests/module-installation-retrofit.integration.test.ts`). Branch/warehouse-scoped grants and manifest-*driven permission registration* (i.e. a per-tenant permission-catalog table, as opposed to the manifest just *declaring* permissions, which it does) are still explicitly deferred — see [ADR-0007](../adr/0007-authorization.md)'s Update.

## Domain ownership

`identity` owns users and their authentication/authorization primitives within a tenant:

- Users and their credentials (implemented — tenant-DB `users` table)
- Permission catalog entries — a plain exported constant (`IDENTITY_PERMISSIONS`), also listed in `identityManifest.permissions` (Phase 7) for shape-completeness; not dynamically *registered into a per-tenant table* by the install step (that remains deferred — see MODULE-SYSTEM.md §3's step 4 note)
- Role definitions and role-to-permission assignments (implemented — tenant-DB `roles` table, `users.role_id`)

Session *records* are owned by `packages/auth`, not `identity` — see the note below.

## Owned entities

- `User` (implemented: `id`, `email`, `passwordHash`, `name`, `status`, `roleId`, timestamps — tenant-DB side)
- `Role` (implemented: `id`, `name`, `permissions: string[]`, `isSystemRole`, timestamps — tenant-DB side)

## Implemented use cases (`modules/identity/src/application`)

- `registerUser` — validates email/password, rejects a duplicate email (`EmailAlreadyRegisteredError`), hashes the password via `@erp/auth`, requires an explicit `roleId` (the caller decides — see `seedDefaultRoles`).
- `verifyCredentials` — returns the user on a correct password; throws the same `InvalidCredentialsError` for both "no such user" and "wrong password" (no account-existence leak, including via response timing — see SECURITY.md §1); throws `UserNotActiveError` for a disabled account.
- `seedDefaultRoles` — idempotently creates the `owner` (wildcard `*`) and `member` (no permissions) system roles for a tenant.
- `getUserPermissions` — loads a user's role's permission list; the last link before `packages/authorization`'s `requirePermission`.
- `applyIdentityMigrations(tenantId)` — applies this module's tenant-DB schema via `@erp/database`'s `runTenantMigrations`; see its doc comment for why it must only be called from ops/admin scripts, never a Next.js Route Handler. Wired into `identityManifest.applyMigrations` (Phase 7), so `modules/core`'s `installModule` calls it as step 3 of installation — this is now the *primary* way it runs (`apps/web/scripts/bootstrap-tenant.ts` no longer calls it directly).

## Dependencies

```text
identity → core
```

Real as of Phase 7 — `modules/identity`'s manifest declares this dependency and `modules/core`'s `installModule` enforces it (installing `identity` before `core` for a given tenant is rejected — proven in `apps/web/tests/module-installation-retrofit.integration.test.ts`).

## Depended on by

`sales`, `purchasing`, `payments`, `pos` (all need to resolve "who is performing this action" and check their role/permissions, once those modules exist) — and, already, `apps/web` (login/logout/me routes via `withAuth`; the sample `/api/identity/users` route via `withPermission`).

## Notes

Identity does not own tenant/branch/warehouse structure — that belongs to `tenant`. A `User` will reference branches/warehouses by ID for scoped role assignments ([ADR-0007](../adr/0007-authorization.md)) without owning those entities, once that exists.

**Session ownership correction (Phase 4):** sessions are owned by `packages/auth` (a shared package), not by `identity` — a session record only ever stores an opaque `userId` (no cross-database FK is possible into a tenant-DB `users` row anyway — see DATABASE.md §1) and is meaningful without ever loading a `User`. `identity` owns *who a user is and whether their password is correct*; `packages/auth` owns *whether a presented session token is currently valid for the resolved tenant*. `apps/web`'s `withAuth` composes both. This is a refinement from the original Phase 1 framing (which listed `Session` as an `identity`-owned entity) — DOMAIN-MODEL.md §2 is updated to match.

See [SECURITY.md](../../SECURITY.md) and [ADR-0006](../adr/0006-authentication.md)/[ADR-0007](../adr/0007-authorization.md) for the full authentication/authorization model.
