# modules/billing

Owns: plans, subscriptions, and billing charges — all control-plane data, never tenant-DB data. See [docs/modules/billing.md](../../docs/modules/billing.md).

Implemented Phase 15: `seedDefaultPlans`/`createSubscription`/`getSubscriptionForTenant`/`recordCharge`, and `SubscriptionEntitlementChecker` — the real implementation of `@erp/core`'s `EntitlementChecker` port, wired into `POST /api/modules/[moduleId]/install` so a tenant can only install a module its subscribed plan includes. Depends only on `core`. No real payment gateway (`StubPaymentGateway` is a documented stand-in, same precedent as `modules/payments`' `SimulatedCardProvider`) and no platform-admin API — plans are seeded via idempotent script, not mutated over HTTP.

Always-installed alongside `core`/`tenant`/`identity` by `apps/web/scripts/bootstrap-tenant.ts`, which also subscribes the new tenant to the `starter` plan — not opt-in like `pos`/`inventory`/`payments`/`delivery`/`reporting`.
