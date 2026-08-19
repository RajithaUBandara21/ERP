# Multi-Tenancy

Status: Implemented through Phase 3 (Tenant System) — tenant resolution, the connection registry, and §5's isolation tests are real code (`modules/tenant`, `packages/database`). Session-based cross-checking (§2) lands in Phase 4. Must stay consistent with [DATABASE.md](./DATABASE.md) and [ADR-0009](./docs/adr/0009-tenant-db-placement.md) — all three describe the same mechanism.

## 1. Isolation model

**Database-per-tenant.** Each tenant's business data lives in its own Postgres database. A separate, smaller **control-plane** database holds platform-wide state (tenants, subscriptions, billing, module registry, domains). No tenant database connection is ever exposed to another tenant's request (CLAUDE.md §11).

Physical placement of tenant databases differs by environment but the *mechanism* is identical everywhere — see [DATABASE.md](./DATABASE.md) §3 and [ADR-0009](./docs/adr/0009-tenant-db-placement.md).

## 2. Request flow

Current (Phase 3 — anonymous/pre-authentication resolution):

```text
Request
 ↓
proxy.ts — hostname → tenant HINT only (header rewrite; not trusted as an authorization decision)
 ↓
Route Handler
 ↓
withTenantContext(): resolveTenantContext(host) — control-plane lookup
 (verified custom domain, else subdomain label → tenants.slug; must be status=active)
 ↓
Tenant database connection (via connection registry, keyed by tenant_id)
 ↓
Application use case
```

Target (from Phase 4 — Authentication — onward), extending the same helper rather than replacing it:

```text
Request
 ↓
proxy.ts — hostname → tenant HINT (unchanged)
 ↓
Route Handler
 ↓
Authenticated session lookup — trusted source of tenant_id
 ↓
Cross-check: session.tenant_id === host-resolved tenant.id → reject on mismatch
 ↓
Tenant database connection (via connection registry, keyed by tenant_id)
 ↓
Authorization context (role, permissions, branch/warehouse scope)
 ↓
Application use case
```

**The browser never supplies a trusted tenant ID.** `resolveTenantContext()` (`modules/tenant`) takes only a hostname — there is no parameter through which a caller could pass an alternate/spoofed tenant identifier, and it never reads request headers/body/query for tenant identity (verified live: a request carrying a spoofed `X-Tenant-Id` header is resolved purely from its `Host`, per `docs/adr/0005-nextjs-app-shell.md`'s Update). Once Phase 4 lands, the database connection additionally requires the session cross-check above before use. This is enforced once via the shared `withTenantContext()` composition helper (`apps/web/src/lib/with-tenant-context.ts`) used by every tenant-scoped Route Handler, so this logic exists in exactly one place in the codebase (see [ADR-0005](./docs/adr/0005-nextjs-app-shell.md)).

Why hostname-based resolution alone is legitimate *before* a session exists: a request has to know which tenant it's for even to reach a login page. This is not an authorization decision — it grants no access to anything, it only selects *which tenant's context* an anonymous request is evaluated against, and an unregistered/unverified host resolves to a clean 404, never a default tenant (§5 tests this directly). It becomes insufficient *alone* the moment an authenticated action is being performed, which is exactly what Phase 4's session cross-check adds.

## 3. Tenant database connection registry

The application maintains an in-memory registry mapping `tenantId → { drizzle client, pool, lastUsedAt }`:

- Populated lazily on first request for a tenant (registry miss → look up connection string in control-plane `tenant_database_registry` → open pool → cache).
- Bounded (LRU eviction) so a single server/function instance does not accumulate unbounded open connections as more tenants are served.
- Each tenant pool is small (e.g. 1–3 connections) — safe under serverless horizontal scaling because an external pooler (see [DATABASE.md](./DATABASE.md) §4) sits in front of Postgres and absorbs the multiplication across function instances.

## 4. Tenant-aware isolation checklist (CLAUDE.md §13)

Every one of these must key off `tenantId` explicitly — there is no implicit/global tenant context:

| Concern | Isolation mechanism |
|---|---|
| Sessions | Session record stores `tenantId`; cross-checked against domain on every request |
| Database routing | Separate physical database per tenant; connection never shared |
| Authorization | Permission checks always evaluated within a resolved tenant's role/permission set |
| Caching | Cache keys always prefixed `tenant:{tenantId}:...` — never a bare key like `products` |
| Background jobs | Every job payload carries `tenantId`; job handlers open the tenant's own DB connection, never a shared/global one |
| Logs | Structured logs include `tenant_id` on every entry |
| Audit records | `AuditLogEntry.tenant_id` always set, never nullable for tenant-scoped actions |
| Files | Object storage keys are tenant-prefixed; signed URLs scoped per tenant/object |
| Events | Event envelopes carry `tenant_id`; consumers reject/ignore events without a matching, authorized tenant context |

## 5. Tenant isolation testing (CLAUDE.md §41)

Mandatory automated tests (introduced starting Phase 3, expanded through later phases) proving Tenant A cannot access Tenant B's data via: API requests with a swapped identifier, direct repository calls with a foreign `tenantId`, cache key collisions, background job payload tampering, file/object storage access, event payloads, and report/export generation. These tests are written to fail loudly if isolation is ever broken — see [TESTING.md](./TESTING.md) §5.

## 6. Custom domains and subdomains

- Default: `{tenant-slug}.platform.example.com` (subdomain resolution — Edge middleware hint from the subdomain label).
- Custom domain: tenant maps a domain (e.g. `pos.customer.com`) which is recorded in the control-plane `domains` table; Edge middleware looks up the domain→tenant-slug mapping from an edge-cacheable source before falling through to the same subdomain-style hint flow.
- In both cases the hint is only ever used to pick which login/session cookie scope to present — the authoritative tenant_id still comes from the verified session once authenticated.
