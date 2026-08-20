/**
 * Billing domain — see docs/modules/billing.md. Plans/subscriptions/billing
 * charges are control-plane data (DATABASE.md §2, DOMAIN-MODEL.md §3: "owned
 * by the platform itself, not any business module"), the same reasoning
 * that makes modules/tenant's Tenant a control-plane-backed domain type.
 *
 * A plan's includedModules deliberately lists every module a subscribed
 * tenant may install, including the always-on foundational ones (core,
 * tenant, identity) — this keeps the entitlement check in
 * subscription-entitlement-checker.ts a single uniform membership test with
 * no special-casing, matching CLAUDE.md §48's own example (a plan is just a
 * list of included modules).
 */

export type BillingInterval = "monthly" | "yearly";

export interface Plan {
  id: string;
  code: string;
  name: string;
  includedModules: string[];
  userLimit: number | null;
  priceCents: number;
  billingInterval: BillingInterval;
  createdAt: Date;
  updatedAt: Date;
}

export class PlanNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Plan not found: ${identifier}`);
    this.name = "PlanNotFoundError";
  }
}
