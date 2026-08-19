# Module: tenant

Status: lifecycle use cases implemented as of Phase 3 (`modules/tenant`); retrofitted with a real `module.manifest.ts` in Phase 7 (depends on `core`, no tenant-DB migrations — see below). Branch/warehouse structure below is architecture-only, still deferred.

## Domain ownership

`tenant` owns two things, in two different places (see DOMAIN-MODEL.md §6 for the full rationale):

1. **Tenant lifecycle** (implemented) — the tenant's existence, slug, name, and status. This lives in the **control-plane** `tenants` table, because tenant identity has to be resolvable *before* any tenant database connection can be opened — it cannot itself live inside the tenant database it describes. Only `modules/tenant`'s repository writes this table.
2. **Tenant-side organizational structure** (not yet implemented) — branches, warehouses, tenant-scoped settings. These will live *inside* each tenant's own database once the module registry (Phase 6) can install per-tenant schemas.

## Owned entities

- `Tenant` (control-plane lifecycle record) — implemented: `id`, `slug`, `name`, `status`, timestamps.
- `Branch`, `Warehouse`, `TenantModuleActivation` (tenant-DB side) — not yet implemented.

## Implemented use cases (`modules/tenant/src/application`)

- `createTenant` — idempotent by slug.
- `getTenantBySlug`.
- `provisionTenantDatabase` — delegates the physical DB creation/registration to `@erp/database` (see [ADR-0009](../adr/0009-tenant-db-placement.md)); this module owns *when/why* to provision, `@erp/database` owns *how*.
- `resolveTenantContext(repository, host)` — the tenant-resolution entry point consumed by `apps/web`'s `withTenantContext()`. See [MULTI-TENANCY.md](../../MULTI-TENANCY.md) §2 for its trust model.
- `tenantManifest` (`module.manifest.ts`, Phase 7) — `dependencies: [{ moduleId: "core", versionRange: "*" }]`, no `applyMigrations` (this module owns no tenant-DB tables yet — see §"Owned entities"). Installed through `modules/core`'s registry the same way `identity` is; see `apps/web/scripts/bootstrap-tenant.ts`.

## Dependencies

```text
tenant → core
```

Real as of Phase 7 — `modules/tenant`'s manifest declares this dependency and `modules/core`'s `installModule` enforces it (installing `tenant` before `core` for a given tenant is rejected).

## Depended on by

`sales`, `purchasing`, `inventory`, `payments`, `pos`, `delivery`, `accounting`, `reporting` (nearly every business module needs branch/warehouse scoping, once that exists) — and, already, `apps/web` (`withTenantContext`) for tenant resolution.

## Notes

`tenant` will own the *warehouse as an organizational location* (name, address, branch association) once implemented; `inventory` owns *what stock is at that warehouse*. This split keeps "where does this location exist" (an org-structure fact) separate from "what's in it" (an inventory fact), consistent with each module owning its own business data (CLAUDE.md §10).

See [MULTI-TENANCY.md](../../MULTI-TENANCY.md) for tenant resolution/routing and [DATABASE.md](../../DATABASE.md) §2 for the control-plane tables this module manages.
