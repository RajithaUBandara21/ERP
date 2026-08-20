# apps/web

The main tenant-facing Next.js application (admin/back-office UI, module UIs, public API surface).

Currently: a minimal App Router skeleton, `/api/health` (control-plane connectivity), `/api/tenant/whoami` (tenant resolution — Phase 3), `/api/auth/{login,logout,me}` (sessions — Phase 4), `/api/identity/users` (permission-gated — Phase 5), `/api/modules` + `/api/modules/[moduleId]/{install,uninstall}` (module registry — Phase 6), `/api/pos/{terminals,carts,carts/[cartId]/{lines,checkout}}` (POS foundation, opt-in module — Phase 8), `/api/inventory/{warehouses,stock,stock/receive,stock/adjust}` (Inventory, opt-in module — Phase 9), `/api/payments/attempts/[attemptId]` + `/api/payments/attempts/[attemptId]/refund` (Payments, opt-in module — Phase 10), `/api/delivery/{drivers,deliveries,deliveries/[deliveryId]/{assign,complete,fail}}` (Delivery, opt-in module — Phase 11), `/api/events/publish` (manually drains the outbox — Phase 13, no background scheduler exists yet), and `/api/reporting/sales-summary` (Reporting, opt-in module — Phase 14, cursor-paginated). No tenant-facing UI yet — see [ARCHITECTURE.md](../../ARCHITECTURE.md) and [ADR-0005](../../docs/adr/0005-nextjs-app-shell.md) for the request-hint/route-handler split this app implements as routes are added.

- `src/proxy.ts` — hostname hint layer (Next.js 16's renamed "proxy" convention — see [ADR-0005](../../docs/adr/0005-nextjs-app-shell.md)'s Update).
- `src/lib/with-tenant-context.ts` — resolves tenant from the host; wraps any tenant-scoped route. Generic over Next's dynamic route `params` (see `[moduleId]` routes) since Phase 6 — the first routes needing them.
- `src/lib/with-auth.ts` — `withTenantContext` + session validation (the cross-tenant check); wraps any authenticated route.
- `src/lib/with-permission.ts` — `withAuth` + `requirePermission()` (loads the user's role permissions and checks); wraps any permission-gated route.
- `src/lib/module-registry.ts` — the app's singleton `@erp/module-registry` `ModuleRegistry`, registering `core`, `tenant`, `identity` (Phase 7), `inventory` (Phase 9), `payments` (Phase 10), `delivery` (Phase 11), `reporting` (Phase 14), and `pos` (Phase 8, now depending on both `inventory` and `payments`) manifests.
- `src/lib/event-consumers.ts` — the app's registered `@erp/events` `EventConsumer`s: delivery's `OrderPaid` handler (Phase 13) and reporting's `OrderPaid` handler (Phase 14) — both react to the same event independently.
- `scripts/bootstrap-tenant.ts` — ops/demo script: provisions a tenant, installs `core` → `tenant` → `identity` **through the registry** (Phase 7 — this is what applies identity's migrations now, not a direct function call), seeds default roles, registers a demo user as **owner**. Does not install `inventory`, `payments`, `delivery`, `reporting`, or `pos` — all five are opt-in; install explicitly via `POST /api/modules/{inventory,payments,delivery,reporting,pos}/install` (inventory and payments before pos — pos depends on both; delivery and reporting have no dependency on the others).

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

# inventory, payments, and pos are all opt-in — pos depends on both inventory and payments, install those first
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/modules/inventory/install
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/modules/payments/install
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/modules/pos/install

curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"sku":"SKU-1","quantity":10}' -X POST http://localhost:3000/api/inventory/stock/receive
curl -b cookies.txt -H "Host: acme.localhost" "http://localhost:3000/api/inventory/stock?sku=SKU-1"

curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"name":"Front Counter"}' -X POST http://localhost:3000/api/pos/terminals
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"terminalId":"<terminal-id>"}' -X POST http://localhost:3000/api/pos/carts
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"sku":"SKU-1","name":"Widget","quantity":2,"unitPriceCents":500}' \
  -X POST http://localhost:3000/api/pos/carts/<cart-id>/lines
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"POS-TERM-001-20260819-000001","paymentMethod":"cash"}' \
  -X POST http://localhost:3000/api/pos/carts/<cart-id>/checkout   # retry with the same idempotencyKey returns the same transaction, not a duplicate; overselling past received stock returns 422 INVENTORY_INSUFFICIENT_STOCK

# card payments dispatch to SimulatedCardProvider (not a real gateway — see docs/modules/payments.md) — "tok_declined" simulates a decline
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"POS-TERM-001-20260819-000002","paymentMethod":"card","paymentMethodToken":"tok_declined"}' \
  -X POST http://localhost:3000/api/pos/carts/<cart-id>/checkout   # 402 PAYMENT_FAILED — the stock reservation is automatically released, not left dangling

curl -b cookies.txt -H "Host: acme.localhost" "http://localhost:3000/api/payments/attempts/<attempt-id>"
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"amountCents":1000,"reason":"customer request"}' \
  -X POST http://localhost:3000/api/payments/attempts/<attempt-id>/refund   # supports partial refunds; a second refund exceeding what remains returns 422

# delivery is opt-in and has no dependency on inventory/payments/pos
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/modules/delivery/install
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"name":"Alex"}' -X POST http://localhost:3000/api/delivery/drivers
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"orderReference":"<pos-transaction-id-or-any-reference>"}' -X POST http://localhost:3000/api/delivery/deliveries
curl -b cookies.txt -H "Host: acme.localhost" -H "Content-Type: application/json" \
  -d '{"driverId":"<driver-id>"}' -X POST http://localhost:3000/api/delivery/deliveries/<delivery-id>/assign   # also valid to reassign a different driver while still "assigned"
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/delivery/deliveries/<delivery-id>/fail    # not terminal — assignable again afterward
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/delivery/deliveries/<delivery-id>/complete

# after a checkout, the resulting OrderPaid event sits in the outbox until published (owner-only, no scheduler exists yet)
curl -b cookies.txt -H "Host: acme.localhost" http://localhost:3000/api/delivery/deliveries   # not created yet
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/events/publish   # {"eventsProcessed":1,"deliveries":2,"failures":0,"deadLettered":0} — one delivery per consumer (delivery + reporting)
curl -b cookies.txt -H "Host: acme.localhost" http://localhost:3000/api/delivery/deliveries   # now has one pending Delivery, orderReference = the PosTransaction id

# reporting is opt-in and has no dependency on inventory/payments/pos/delivery — it only subscribes to OrderPaid
curl -b cookies.txt -H "Host: acme.localhost" -X POST http://localhost:3000/api/modules/reporting/install
curl -b cookies.txt -H "Host: acme.localhost" "http://localhost:3000/api/reporting/sales-summary"   # {"items":[{"date":"...","transactionCount":1,"totalCents":500,"updatedAt":"..."}]} — reflects the published sale above
curl -b cookies.txt -H "Host: acme.localhost" "http://localhost:3000/api/reporting/sales-summary?limit=1"   # cursor pagination — response includes "nextCursor" when more rows exist
```
