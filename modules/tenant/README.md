# modules/tenant

Tenant lifecycle module: create/provision/resolve a tenant. See [docs/modules/tenant.md](../../docs/modules/tenant.md) for full domain-ownership detail (including the control-plane vs tenant-DB-side split) and [MULTI-TENANCY.md](../../MULTI-TENANCY.md) for the request-resolution flow this module implements.

- `domain/tenant.ts` — the `Tenant` entity and domain errors.
- `application/` — `createTenant`, `getTenantBySlug`, `provisionTenantDatabase`, `resolveTenantContext` (host → tenant + its DB handle), plus pure hostname-parsing helpers.
- `infrastructure/drizzle-tenant-repository.ts` — the control-plane-backed `TenantRepository` implementation.
- `module.manifest.ts` — `tenantManifest` (Phase 7): depends on `core`, no tenant-DB migrations yet.

Branches/warehouses/tenant-scoped settings (tenant-DB side) are not yet implemented — deferred until a module actually needs them.
