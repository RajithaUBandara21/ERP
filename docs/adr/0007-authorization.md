# ADR-0007: Authorization Model (RBAC + Scoped Permissions)

- Status: Accepted (amended during Phase 5 implementation — see Update below)
- Date: 2026-08-19

## Context

CLAUDE.md §14 requires RBAC plus fine-grained, resource/branch/warehouse-scoped authorization, always enforced server-side, with permissions namespaced per module/action (e.g. `POS.ORDER.REFUND`, `INVENTORY.STOCK.ADJUST`). Authorization must compose with both the module system (a permission only exists if its owning module is installed and active for the tenant) and multi-tenancy (a role assignment is meaningless outside its tenant).

## Decision

```text
User → Tenant → Organization → Role → Permissions → Resource/Branch/Warehouse scope
```

- Permissions are namespaced strings declared by each module's manifest (`PermissionDefinition[]`, [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md) §2) and registered into the tenant's permission catalog only when that module is installed — an uninstalled module's permissions cannot be assigned or checked.
- Roles are tenant-scoped collections of permissions; a role assignment can additionally be scoped to specific branches and/or warehouses, so e.g. an `INVENTORY.STOCK.ADJUST` grant can be limited to a subset of a tenant's warehouses.
- A single `requirePermission(permission, scope?)` guard, invoked from the application layer (never the UI layer), is the only path by which an operation checks authorization — evaluated only after tenant context is resolved ([ADR-0005](./0005-nextjs-app-shell.md)), so a permission check can never accidentally evaluate against the wrong tenant's roles.
- Default-deny: absence of an explicit grant means denied, not allowed.

## Alternatives Considered

- **Attribute-based access control (ABAC) / policy engine (e.g. OPA/Cedar) from the start**: rejected for this phase — more expressive than the platform currently needs, and CLAUDE.md §55 cautions against introducing machinery ahead of a demonstrated requirement. RBAC + explicit resource/branch/warehouse scoping covers every example in CLAUDE.md §14. Revisit only if a concrete requirement (e.g. complex approval-chain policies) can't be expressed cleanly in this model.
- **Frontend-enforced authorization (hide/disable UI elements as the only check)**: explicitly rejected — CLAUDE.md §14 and §63 forbid treating hidden frontend buttons as authorization; the UI may use permission data to *improve UX* (hide actions the user can't perform) but the server-side guard is the only actual control.
- **Per-module ad-hoc permission checks (no shared guard)**: rejected — would duplicate the tenant/role/scope evaluation logic per module, the exact "duplicated business rules" anti-pattern CLAUDE.md §59 warns against, and would make it easy for a new module to accidentally skip a check.

## Consequences

- Every module must declare its permissions through its manifest rather than inventing ad-hoc checks — keeps the permission catalog centrally auditable per tenant.
- Branch/warehouse-scoped grants require the scope to be threaded through every relevant use case's authorization check, not just the coarse "does this role have this permission" check — a deliberate design cost in exchange for the fine-grained control CLAUDE.md §14 requires.
- Security tests (horizontal/vertical privilege escalation, IDOR — CLAUDE.md §42) are written against this single guard's behavior, giving broad coverage from a small, well-tested surface rather than needing to test every module's bespoke authorization code.

## Update (Phase 5 implementation)

Two deliberate scope reductions from the decision above, made explicitly (asked of and confirmed by the user before implementation) rather than discovered as gaps:

1. **No branch/warehouse scope yet.** `Branch`/`Warehouse` entities don't exist until Phase 6+ (they need the module registry to install per-tenant schemas — see [docs/modules/tenant.md](../modules/tenant.md)), so there is nothing to scope a grant *to*. `packages/authorization`'s `requirePermission(grantedPermissions, required)` checks only the flat permission string for now. Its signature takes a plain string array specifically so a scope parameter can be added later without breaking existing callers, once Branch/Warehouse exist.
2. **No manifest-driven permission registration yet.** Since the module manifest/registry system is Phase 6 scope, `modules/identity` declares its permission catalog as a plain exported constant (`IDENTITY_PERMISSIONS`) rather than via a `ModuleManifest.permissions` array read by a registry — the same stand-in pattern already used for `applyIdentityMigrations` (see [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md) §3, `DATABASE.md` §6). Each future module will declare its own catalog the same way until Phase 6 generalizes this.

What *is* implemented and tested against a real database: `Role`/`Permission` (tenant-DB `roles` table, `users.role_id`), two seeded system roles (`owner` = wildcard `*`, `member` = default-deny empty set), `requirePermission()`, and `apps/web`'s `withPermission()` composing the full session → tenant → role → permission chain — proven live via curl (owner 200, member 403 `PERMISSION_DENIED`, unauthenticated 401) in addition to automated integration tests.
