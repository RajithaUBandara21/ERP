# Module: billing

Status: implemented Phase 15 (`modules/billing`). No Phase 1 placeholder existed for this doc — DOMAIN-MODEL.md §3 already noted that subscriptions/billing are "owned by the platform itself, not any business module," so this was written directly against that constraint rather than retrofitted.

## Domain ownership

`billing` owns plans, subscriptions, and billing charges — all control-plane data (DATABASE.md §2), never tenant-DB data. It is the first real consumer of the `plans`/`subscriptions`/`billing` control-plane tables that existed as unused Phase 2 placeholders in `packages/database/src/control-plane/schema.ts` until this phase.

## Owned entities

- `Plan` — a code, name, `includedModules: string[]`, `userLimit`, `priceCents`, `billingInterval`. Global, not tenant-scoped.
- `Subscription` — one per tenant (`subscriptions.tenant_id` has a real unique index, added this phase — see "Notes"), status `trialing | active | past_due | canceled`.
- `BillingCharge` — a record of one charge attempt against the platform's stub payment gateway, status `pending | paid | failed | refunded`.

## Dependencies

```text
billing → core
```

Mirrors `tenant`'s and `identity`'s minimal foundational dependency. No tenant-DB migrations (`module.manifest.ts` omits `applyMigrations`, same choice as `tenant`).

## Depended on by

Nothing declares a manifest dependency on `billing`. Instead, `modules/core`'s `installModule` accepts an injected `EntitlementChecker` port (`modules/core/src/application/entitlement-checker.ts`) — `billing`'s `SubscriptionEntitlementChecker` is the real implementation, wired in by `apps/web`'s install route (the composition root). This keeps `core` foundational and dependency-free (its manifest still declares zero dependencies) while making entitlement checking real. The same Ports & Adapters seam `modules/pos` uses for `StockReservationPort`/`PaymentCapturePort`.

## Implementation status (Phase 15)

- **Built**: `seedDefaultPlans` (idempotent upsert of two plans — see below), `createSubscription` (idempotent per tenant, backed by a real DB unique index on `subscriptions.tenant_id`), `getSubscriptionForTenant`, `recordCharge` (charges the tenant's plan price via a `PaymentGatewayPort`, records paid/failed — never throws on a decline), and `SubscriptionEntitlementChecker` (fails closed: no subscription, or a `past_due`/`canceled` one, entitles nothing).
- **Default plans**: `starter` (`core, tenant, identity, pos, inventory, payments` — payments is included even though it's not a separate customer-facing toggle, because `pos` hard-depends on it; a plan that omitted it could never actually finish installing `pos` through the entitlement-gated route) and `growth` (adds `delivery`, `reporting`). Matches CLAUDE.md §1's Tenant A/B illustration.
- **Entitlement enforcement**: wired into `POST /api/modules/[moduleId]/install` only — `installModule`'s new `entitlementChecker` parameter defaults to `AllowAllEntitlementChecker` (modules/core), so every pre-existing caller (scripts, other modules' tests, `apps/web/scripts/bootstrap-tenant.ts` installing the always-on foundational modules) is unaffected; only the real HTTP install route passes the real, billing-backed checker.
- **Payment gateway**: `StubPaymentGateway` — a documented stand-in, the same precedent as `modules/payments`' `SimulatedCardProvider`. No real gateway (Stripe or otherwise) is integrated.
- **No billing-cycle scheduler**: `POST /api/billing/charge` is a manual trigger, the same "no background job system yet" precedent as `POST /api/events/publish` (CLAUDE.md §27).
- **No platform-admin authentication**: plan mutation and subscription assignment happen via idempotent scripts (`seedDefaultPlans`, `bootstrap-tenant.ts`), not an HTTP API — there is no `platform_users`-backed auth system yet to gate a "manage the global plan catalog" endpoint with (the `platform_users` control-plane table itself remains an unused Phase 2 placeholder, same as `plans`/`subscriptions`/`billing` were before this phase). The only HTTP routes this module exposes (`GET /api/billing/subscription`, `POST /api/billing/charge`) are tenant-scoped and gated by the tenant's own existing RBAC. A real platform back-office is a future need, not yet built.
- **No proration/downgrade logic**: changing a tenant's plan after modules are already installed (e.g. downgrading past a module it currently has active) is out of scope — `createSubscription` is idempotent per tenant and does not support switching plans once subscribed.

## Notes

**Real schema fix, not just new code**: `subscriptions` had no unique constraint on `tenant_id` in the Phase 2 placeholder schema — nothing had used the table yet, so the gap was invisible. Since `createSubscription` needs "idempotent per tenant, relying on a DB-level constraint, not a check-then-insert race" (the same pattern `DrizzleTenantRepository.create` already established), a migration (`0002_add_subscriptions_tenant_unique_index.sql`) adds `uniqueIndex("subscriptions_tenant_id_idx")` before this module's repository was written against it.

See [EVENTS.md](../../EVENTS.md) for how `modules/core`'s Ports & Adapters seam pattern (used here for entitlement) also appears elsewhere in this codebase, and [MODULE-SYSTEM.md](../../MODULE-SYSTEM.md) for the full install sequence this module's check now participates in (a new step between "already installed?" and dependency validation).
