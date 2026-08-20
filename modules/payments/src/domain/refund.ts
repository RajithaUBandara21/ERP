export interface Refund {
  id: string;
  paymentAttemptId: string;
  amountCents: number;
  reason: string | null;
  providerRefundId: string;
  createdAt: Date;
}
