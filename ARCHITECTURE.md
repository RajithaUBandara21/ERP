# Architecture Overview

Status: Phase 1 (architecture only — no application code yet). Governing spec: [CLAUDE.md](./CLAUDE.md).

## 1. System purpose

A commercial, multi-tenant ERP SaaS platform (conceptually similar to Odoo/ERPNext) where each tenant (business) subscribes to the platform and installs only the modules it needs (POS, Inventory, Delivery, Payments, Sales, Purchasing, Accounting, Reporting, ...). Target scale: ~1,000 tenants, up to 2,000 users and 50 POS terminals per tenant, without provisioning for that scale during initial development.

## 2. Architectural style

```text
Domain-Driven Design
+ Modular Monolith
+ Clean / Hexagonal Architecture
+ Event-Driven Integration
+ Database-per-Tenant
+ Offline-First POS
+ API-first design
```

The platform is **not** built as microservices. It is a single deployable Next.js application composed of strictly-bounded modules, each designed so it *could* later be extracted into an independent service without a rewrite (see [ADR-0001](./docs/adr/0001-modular-monolith.md)).

```text
Next.js Application
│
├── Core Platform     (module registry, feature flags, audit, configuration)
├── Identity          (users, sessions, permission catalog)
├── Tenant            (tenant lifecycle, branches, warehouses)
├── Sales             (customers, quotations, sales orders)
├── Purchasing        (suppliers, purchase orders)
├── Inventory         (stock, warehouses, movements, reservations)
├── Payments          (payment methods, provider abstraction, refunds)
├── POS               (transactions, carts, receipts, terminals)
├── Delivery          (deliveries, drivers, assignments)
├── Accounting        (ledger, invoicing)
└── Reporting         (read-optimized aggregation)
```

## 3. Layering (per module)

Every business module follows Clean/Hexagonal layering (full structure in [MODULE-SYSTEM.md](./MODULE-SYSTEM.md)):

```text
interfaces/      → API route handlers, Server Actions, UI — thin, no business logic
application/      → use cases, commands, queries — orchestration, transaction boundaries
domain/           → entities, value objects, domain services, domain events — pure business rules
infrastructure/   → repository implementations, persistence, external integrations
```

Dependencies point inward: `interfaces → application → domain`. `infrastructure` implements interfaces defined by `domain`/`application` (dependency inversion) rather than the domain depending on infrastructure. Business logic never lives in `interfaces/` or in React components — see [ADR-0005](./docs/adr/0005-nextjs-app-shell.md) for how this maps onto Next.js's App Router.

## 4. Module boundaries

A module owns its business data and business rules exclusively (CLAUDE.md §10). Cross-module interaction happens only through:

1. **Synchronous application-interface calls** — module A calls module B's published application service/use case (never B's database or ORM models directly).
2. **Asynchronous domain events** — module A publishes an event (via the transactional [outbox](./EVENTS.md)); module B subscribes and reacts idempotently.

```text
POS → Inventory application interface → Inventory domain → Inventory database   (allowed)
POS → Inventory database directly                                              (forbidden)
```

Module boundaries are enforced by:
- Directory structure convention (each module's `domain`/`infrastructure` are not exported outside `interfaces`/`application` public surfaces).
- Lint rule (`eslint-plugin-boundaries` or equivalent) forbidding imports into another module's `domain`/`infrastructure` folders, and forbidding any import not on the module's declared dependency list ([ADR-0010](./docs/adr/0010-monorepo-tooling.md)).
- Module manifest dependency declarations, validated for cycles at install time ([MODULE-SYSTEM.md](./MODULE-SYSTEM.md)).

See [DOMAIN-MODEL.md](./DOMAIN-MODEL.md) for the full module dependency graph and [docs/modules/](./docs/modules/) for per-module ownership detail.

## 5. Multi-tenancy

A control-plane database holds platform-wide state (tenants, subscriptions, billing, module registry). Each tenant's business data lives in its own Postgres database. Tenant context is resolved server-side from the authenticated session — never trusted from the browser. Full detail in [MULTI-TENANCY.md](./MULTI-TENANCY.md) and [DATABASE.md](./DATABASE.md).

## 6. Cross-cutting concerns

| Concern | Summary | Detail |
|---|---|---|
| Authentication & authorization | Custom session/token layer on audited primitives; RBAC with branch/warehouse-scoped permissions | [SECURITY.md](./SECURITY.md) |
| Offline POS | IndexedDB local state, durable sync queue, idempotent sync | [OFFLINE-POS.md](./OFFLINE-POS.md) |
| Integration | Domain events + transactional outbox | [EVENTS.md](./EVENTS.md) |
| Data | Database-per-tenant, Drizzle ORM, migrations | [DATABASE.md](./DATABASE.md) |
| Deployment | Docker Compose (dev) → Vercel + managed Postgres (demo) → AWS (production) | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Testing | Unit/integration/contract/E2E/security/performance | [TESTING.md](./TESTING.md) |
| Internationalization | `next-intl`, route-based locale + tenant/user preference; API errors localize client-side by stable `code` | [ADR-0011](./docs/adr/0011-internationalization.md) |

## 7. Repository structure

```text
erp-platform/
├── apps/            web (Next.js), pos (PWA/offline shell), delivery-mobile
├── modules/         core, identity, tenant, pos, inventory, delivery, payments,
│                    sales, purchasing, accounting, reporting
├── packages/        ui, database, validation, auth, authorization, events,
│                    logging, configuration
├── infrastructure/  docker, aws, scripts
├── docs/            architecture, adr, api, security, operations, modules
└── tests/           cross-cutting e2e
```

Monorepo tooling: **pnpm workspaces + Turborepo** ([ADR-0010](./docs/adr/0010-monorepo-tooling.md)).

## 8. Explicit non-goals (do not overengineer — CLAUDE.md §55)

Not introduced unless a measured, demonstrated requirement emerges:

- Kubernetes, service mesh
- Kafka or any external broker (the outbox uses a relational table + polling/logical-replication publisher initially)
- Microservices
- Distributed transactions across databases
- Multiple databases per module

## 9. Implementation roadmap

Full detail and exit criteria are in the approved plan. Sequence (CLAUDE.md §54):

```text
1. Architecture              ✓ done
2. Core platform             ✓ done
3. Tenant system             ✓ done — modules/tenant, apps/web proxy + withTenantContext
4. Authentication            ✓ done — packages/auth, modules/identity, apps/web withAuth
5. Authorization              ✓ done — packages/authorization, Role/Permission, apps/web withPermission
6. Module registry            ✓ done — packages/module-registry, modules/core, apps/web /api/modules
7. Module installation         ✓ done — tenant/identity retrofitted with real manifests; identity's migrations now run via the manifest's applyMigrations hook, not a direct call (see apps/web/tests/module-installation-retrofit.integration.test.ts). Remaining scope (wire permission/route/config/event registration) deferred until those systems exist — see MODULE-SYSTEM.md §3.
8. POS foundation             ✓ done — modules/pos (terminals, carts, idempotent checkout via PosTransaction); depends only on core/tenant/identity, not sales/inventory/payments (none exist yet) — stock deduction and payment capture are stubbed behind StockReservationPort/PaymentCapturePort (no-op/always-succeeds implementations), to be replaced when Phases 9–10 land. Opt-in, not auto-installed by bootstrap-tenant.ts. i18n remains plan-only (ADR-0011) — no UI exists yet to localize.
9. Inventory              ✓ done — modules/inventory (warehouses, ledger-backed stock levels, reserve/confirm/release lifecycle per CLAUDE.md §21); pos retrofitted with a real StockReservationPort and now depends on inventory. Discovered and fixed a real bug: drizzle's default migrator tracks "already applied" via a single cross-module timestamp watermark, so a module's migrations could get silently skipped depending on install order vs. generation order — fixed by giving every module its own migrations tracking table (see packages/database/src/tenant/migrate.ts).
10. Payments              ✓ done — modules/payments (PaymentAttempt/Refund ledger, CashProvider [real], SimulatedCardProvider [documented stand-in, no real gateway integration], idempotent capture, concurrency-safe partial/full refund via row-locking). pos retrofitted with a real PaymentsCapturePort; checkout() now threads a `paymentMethodToken` through for tokenized providers. Live-verified: cash checkout, card decline (with automatic stock-reservation release), card success, GET/refund via /api/payments/attempts/*, idempotent retry.
11. Delivery              ✓ done — modules/delivery (Driver, Delivery, and an append-only DeliveryAssignment audit ledger). No `sales` module exists (and it isn't one of this list's 19 scheduled phases), so Delivery.orderReference is an opaque string rather than a foreign key — depends only on core/tenant/identity. State machine: pending → assigned (→ reassign mid-flight, or → completed) with a fail → retry path (CLAUDE.md §34), all live-verified.
12. Offline POS           ✓ done — apps/pos, a new Next.js app (true foundation scope, confirmed with the user before implementation): IndexedDB-backed durable local cart + sync queue (`idb`), idempotent offline-to-online sync reusing pos's existing checkout API, exponential backoff + jitter on network failure, and a "conflict" status (not auto-retried) for definitive server rejections like oversell — no backorder/negative-inventory allowance exists server-side, so that's a documented scope boundary, not a bug. Real bug found and fixed via live cross-app verification: apps/web's own proxy.ts unconditionally overwrote the tenant host hint header from its own Host header, breaking apps/pos's same-origin API rewrite (see ADR-0005's Update).
13. Events/outbox         ✓ done — packages/events (outbox + processed_events tables, per-consumer idempotent delivery, retry with dead-lettering after 5 attempts). Wired through modules/core's own applyMigrations hook, since the outbox must exist before any module publishes — not a new ModuleManifest entry. pos's checkout() writes `OrderPaid` in the same DB transaction as the sale (ADR-0004, genuinely verified: an event written inside a transaction that then rolls back never appears in the outbox); delivery consumes it to idempotently create a pending Delivery — EVENTS.md §6's worked example, implemented and live-verified end to end. No background scheduler exists yet (CLAUDE.md §27) — the publisher is triggered via a permission-gated `POST /api/events/publish` until one does.
14. Reporting             ← current phase
15. SaaS billing
16. Observability
17. Performance
18. Security hardening
19. Production deployment
```

## 10. Ambiguities resolved during Phase 1

CLAUDE.md §9's dependency examples reference a "Customer" module that does not appear in §5's module list. Resolution: **customer entities are owned by the `sales` module** (a customer is fundamentally a sales-domain concept — the party that places orders). POS and Delivery obtain customer data through Sales' application interface rather than owning a separate Customer module. This is recorded in [docs/modules/sales.md](./docs/modules/sales.md) and reflected in the dependency graph in [DOMAIN-MODEL.md](./DOMAIN-MODEL.md).

CLAUDE.md §53 and §61 list two overlapping sets of architecture documents. Resolution: the top-level docs listed in §61 (this file and its siblings) are authoritative; `docs/architecture/` holds only the two topics without a top-level equivalent (`scalability.md`, `observability.md`).
