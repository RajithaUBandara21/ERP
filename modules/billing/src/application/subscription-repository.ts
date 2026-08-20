import type { Subscription } from "../domain/subscription";

/** Port (dependency-inversion boundary) implemented by infrastructure/repositories — see ARCHITECTURE.md §3. */
export interface SubscriptionRepository {
  /** The tenant's current subscription, regardless of status (callers decide what to do with a canceled/past_due one). */
  findForTenant(tenantId: string): Promise<Subscription | undefined>;
  /** Idempotent: a tenant with an existing subscription (any status) is returned unchanged, never duplicated — see create-subscription.ts. */
  create(input: { tenantId: string; planId: string }): Promise<Subscription>;
  updateStatus(id: string, status: Subscription["status"]): Promise<void>;
}
