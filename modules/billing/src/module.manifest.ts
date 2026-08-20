import type { ModuleManifest } from "@erp/module-registry";
import { BILLING_PERMISSIONS } from "./domain/permissions";

/**
 * billing's manifest — Phase 15. No tenant-DB migrations: plans,
 * subscriptions, and billing charges are control-plane data (DATABASE.md
 * §2, DOMAIN-MODEL.md §3), the same "operates on the control-plane
 * directly, applyMigrations omitted" choice as modules/tenant. Depends
 * only on core, mirroring tenant/identity's minimal foundational deps — by
 * the time any module install is attempted, the tenant record (and
 * therefore a subscription) already exists.
 *
 * Deliberately NOT gated by a separate platform-operator authentication
 * system: plan/subscription creation happen via idempotent scripts
 * (seedDefaultPlans, bootstrap-tenant.ts), not an HTTP API, so there is no
 * "who can mutate the global plan catalog" surface to protect yet. The
 * only HTTP routes this manifest's permissions gate are tenant-scoped
 * (a tenant reading/charging its own subscription) via the existing
 * tenant RBAC — the same pragmatic choice CORE.EVENTS.PUBLISH made. A real
 * platform back-office (distinct platform_users auth) is a future need,
 * not yet built — see docs/modules/billing.md's Implementation status.
 */
export const billingManifest: ModuleManifest = {
  id: "billing",
  name: "Billing",
  version: "1.0.0",
  description: "Plans, subscriptions, and billing charges — module entitlements gated by the tenant's subscribed plan.",
  dependencies: [{ moduleId: "core", versionRange: "*" }],
  permissions: [
    { key: BILLING_PERMISSIONS.SUBSCRIPTION_READ, description: "Read the tenant's own subscription and plan" },
    { key: BILLING_PERMISSIONS.CHARGE_RECORD, description: "Manually charge the tenant's current subscription amount" },
  ],
  routes: [],
  eventsPublished: [],
  eventsConsumed: [],
  configuration: [],
};
