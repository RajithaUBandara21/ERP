# apps/web

The main tenant-facing Next.js application (admin/back-office UI, module UIs, public API surface).

Currently: a minimal App Router skeleton, `/api/health` (control-plane connectivity), `/api/tenant/whoami` (tenant resolution — Phase 3), `/api/auth/{login,logout,me}` (sessions — Phase 4), `/api/identity/users` (permission-gated — Phase 5), `/api/modules` + `/api/modules/[moduleId]/{install,uninstall}` (module registry — Phase 6), and `/api/pos/{terminals,carts,carts/[cartId]/{lines,checkout}}` (POS foundation, opt-in module — Phase 8). No tenant-facing UI yet — see [ARCHITECTURE.md](../../ARCHITECTURE.md) and [ADR-0005](../../docs/adr/0005-nextjs-app-shell.md) for the request-hint/route-handler split this app implements as routes are added.

- `src/proxy.ts` — hostname hint layer (Next.js 16's renamed "proxy" convention — see [ADR-0005](../../docs/adr/0005-nextjs-app-shell.md)'s Update).
- `src/lib/with-tenant-context.ts` — resolves tenant from the host; wraps any tenant-scoped route. Generic over Next's dynamic route `params` (see `[moduleId]` routes) since Phase 6 — the first routes needing them.
- `src/lib/with-auth.ts` — `withTenantContext` + session validation (the cross-tenant check); wraps any authenticated route.
- `src/lib/with-permission.ts` — `withAuth` + `requirePermission()` (loads the user's role permissions and checks); wraps any permission-gated route.
- `src/lib/module-registry.ts` — the app's singleton `@erp/module-registry` `ModuleRegistry`, registering `core`, `tenant`, `identity` (Phase 7), and `pos` (Phase 8) manifests.
- `scripts/bootstrap-tenant.ts` — ops/demo script: provisions a tenant, installs `core` → `tenant` → `identity` **through the registry** (Phase 7 — this is what applies identity's migrations now, not a direct function call), seeds default roles, registers a demo user as **owner**. Does not install `pos` — it's opt-in, install it explicitly via `POST /api/modules/pos/install`.

```bash
pnpm --filter @erp/web bootstrap:tenant -- --slug=acme --name="Acme Retail" --email=owner@acme.test --password=supersecret1
pnpm --filter @erp/web dev    # requires infrastructure/docker stack running

curl http://localhost:3000/api/health
curl -H "Host: acme.localhost" http://localhost:3000/api/tenant/whoami
curl -c cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"email":"owner@acme.test","password":"supersecret1"}' http://localhost:3000/api/auth/login
curl -b cookies.txt -H "Host: acme.localhost" http://localhost:3000/api/auth/me
curl -b cookies.txt -H "Host: acme.localhost" http://localhost:3000/api/identity/users   # owner → 200; no session → 401; a member-role session → 403

curl -b cookies.txt -H "Host: acme.localhost" http://localhost:3000/api/modules          # core, tenant, identity all active (bootstrap installs them)
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/modules/core/uninstall
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/modules/core/install

# pos is opt-in — must be installed explicitly before its routes work
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/modules/pos/install
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"name":"Front Counter"}' -X POST http://localhost:3000/api/pos/terminals
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"terminalId":"<terminal-id>"}' -X POST http://localhost:3000/api/pos/carts
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"sku":"SKU-1","name":"Widget","quantity":2,"unitPriceCents":500}' \
  -X POST http://localhost:3000/api/pos/carts/<cart-id>/lines
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"POS-TERM-001-20260819-000001","paymentMethod":"cash"}' \
  -X POST http://localhost:3000/api/pos/carts/<cart-id>/checkout   # retry with the same idempotencyKey returns the same transaction, not a duplicate
```
