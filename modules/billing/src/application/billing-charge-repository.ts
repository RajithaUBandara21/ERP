import type { BillingCharge } from "../domain/billing-charge";

/** Port (dependency-inversion boundary) implemented by infrastructure/repositories — see ARCHITECTURE.md §3. */
export interface BillingChargeRepository {
  create(input: { tenantId: string; amountCents: number; currency: string }): Promise<BillingCharge>;
  markPaid(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  listForTenant(tenantId: string): Promise<BillingCharge[]>;
}
