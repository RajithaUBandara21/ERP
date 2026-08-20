# ERP Platform

A production-grade, multi-tenant ERP SaaS platform built as a modular monolith with future service-extraction capability.

This repository has completed **Phase 12 (Offline POS)**, "true foundation" scope: `apps/pos`, a new Next.js app and this project's first real UI, implements a durable IndexedDB-backed local cart and sync queue (`idb`), proving the full offline-write → reconnect → idempotent-sync path for one golden flow, reusing `pos`'s existing checkout API rather than a parallel code path. `apps/pos` proxies its API calls to `apps/web` same-origin (not CORS, since the session cookie's `SameSite=Lax` wouldn't survive a genuinely cross-origin fetch) — live cross-app verification (curl against both apps' running dev servers) caught a real bug: `apps/web`'s own `proxy.ts` was unconditionally overwriting the tenant host hint from its own Host header, breaking every proxied request; fixed without weakening the documented trust model (see [ADR-0005](./docs/adr/0005-nextjs-app-shell.md)'s Update). See [OFFLINE-POS.md](./OFFLINE-POS.md), [ADR-0003](./docs/adr/0003-offline-pos.md)'s Update, and [apps/pos/README.md](./apps/pos/README.md) for exactly what shipped vs. what's still open (no browser-automation tool was available to visually verify the React UI itself — flagged explicitly, not glossed over). See [CLAUDE.md](./CLAUDE.md) for the full governing specification and [docs/adr/](./docs/adr/) for the architecture decisions made so far.

## Start here

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system overview, architectural style, layering.
- [DOMAIN-MODEL.md](./DOMAIN-MODEL.md) — modules, domain ownership, aggregates.
- [MODULE-SYSTEM.md](./MODULE-SYSTEM.md) — module manifest, installation, dependency validation.
- [MULTI-TENANCY.md](./MULTI-TENANCY.md) — tenant resolution, database-per-tenant, isolation.
- [SECURITY.md](./SECURITY.md) — authentication, authorization, OWASP controls.
- [OFFLINE-POS.md](./OFFLINE-POS.md) — offline-first POS architecture, sync, idempotency.
- [EVENTS.md](./EVENTS.md) — domain events, outbox pattern, consumers.
- [DATABASE.md](./DATABASE.md) — control plane vs tenant databases, ORM decision, migrations.
- [DEPLOYMENT.md](./DEPLOYMENT.md) — dev/demo/production deployment topology.
- [TESTING.md](./TESTING.md) — testing strategy across all test types.
- [docs/adr/](./docs/adr/) — Architecture Decision Records.
- [docs/modules/](./docs/modules/) — per-module domain ownership and dependency declarations.

## Repository layout

```text
apps/            Deployable applications (web, pos, delivery-mobile)
modules/         Business modules (core, identity, tenant, pos, inventory, ...)
packages/        Shared libraries (ui, database, auth, authorization, events, ...)
infrastructure/  Docker, AWS, and operational scripts
docs/            Architecture docs, ADRs, security, operations, module docs
tests/           Cross-cutting end-to-end tests
```

Each module and package directory contains its own README describing its scope; see [docs/modules/](./docs/modules/) for full domain-ownership documentation.

## Working with this repository

- Package manager: **pnpm** (`packageManager` pinned in [package.json](./package.json)).
- Task runner: **Turborepo** (`turbo.json`).
- Node.js **20+** required.

```bash
pnpm install

# Local dev stack (Postgres on host port 5433, Redis, MinIO) — see infrastructure/docker
docker compose -f infrastructure/docker/docker-compose.yml up -d
cp .env.example .env

# Control-plane schema
pnpm db:migrate

pnpm typecheck
pnpm lint
pnpm test       # unit tests everywhere; DB-backed integration tests run automatically
                # once CONTROL_PLANE_DATABASE_URL/TENANT_DATABASE_ADMIN_URL are set, else skipped
pnpm build

pnpm --filter @erp/web bootstrap:tenant -- --slug=acme --name="Acme Retail" --email=owner@acme.test --password=supersecret1

pnpm --filter @erp/web dev   # http://localhost:3000/api/health should return {"status":"ok",...}

# In another terminal — tenant resolution reads only the Host header, see MULTI-TENANCY.md §2
curl -H "Host: acme.localhost" http://localhost:3000/api/tenant/whoami

# Login — sets an httpOnly session cookie, then /me proves it's bound to this tenant (see SECURITY.md §1)
curl -c cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"email":"owner@acme.test","password":"supersecret1"}' http://localhost:3000/api/auth/login
curl -b cookies.txt -H "Host: acme.localhost" http://localhost:3000/api/auth/me

# Permission-gated route (see SECURITY.md §2) — the bootstrap script's user is "owner", so this succeeds
curl -b cookies.txt -H "Host: acme.localhost" http://localhost:3000/api/identity/users

# Module registry (see MODULE-SYSTEM.md) — bootstrap already installed "core" for this tenant
curl -b cookies.txt -H "Host: acme.localhost" http://localhost:3000/api/modules
```

See the roadmap in [ARCHITECTURE.md](./ARCHITECTURE.md#9-implementation-roadmap) for what's next (Phase 13, Events/Outbox).

## Development principles

This project follows the rules in [CLAUDE.md](./CLAUDE.md), most importantly:

- Modules own their data; no module reads or writes another module's tables directly.
- Tenant context is always derived from the authenticated session, never from client input.
- Business logic lives in domain/application layers, never in route handlers or UI components.
- Architectural changes require an ADR before implementation.
