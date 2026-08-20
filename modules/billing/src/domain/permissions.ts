/** This module's permission catalog — see modules/core/src/domain/permissions.ts for the same pattern. Gated by the tenant's own RBAC (withPermission), not a separate platform-operator auth system — see module.manifest.ts's doc comment on that deferred scope. */
export const BILLING_PERMISSIONS = {
  SUBSCRIPTION_READ: "BILLING.SUBSCRIPTION.READ",
  /** Manually charges the tenant's current subscription amount — no billing-cycle scheduler exists yet (CLAUDE.md §27), so this is the trigger until one does, mirroring CORE.EVENTS.PUBLISH's precedent. */
  CHARGE_RECORD: "BILLING.CHARGE.RECORD",
} as const;

export type BillingPermission = (typeof BILLING_PERMISSIONS)[keyof typeof BILLING_PERMISSIONS];
