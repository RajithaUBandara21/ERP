export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class NoSubscriptionError extends Error {
  constructor(tenantId: string) {
    super(`Tenant has no subscription: ${tenantId}`);
    this.name = "NoSubscriptionError";
  }
}

/** trialing/active are the only statuses that grant module entitlements — see subscription-entitlement-checker.ts. */
export function isEntitled(status: SubscriptionStatus): boolean {
  return status === "trialing" || status === "active";
}
