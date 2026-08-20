export type BillingChargeStatus = "pending" | "paid" | "failed" | "refunded";

export interface BillingCharge {
  id: string;
  tenantId: string;
  amountCents: number;
  currency: string;
  status: BillingChargeStatus;
  issuedAt: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
