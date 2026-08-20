import { randomUUID } from "node:crypto";
import type { TenantDb } from "@erp/database";
import { RefundExceedsCapturedAmountError } from "../src/domain/errors";
import type { PaymentAttempt, PaymentAttemptStatus } from "../src/domain/payment-attempt";
import type { Refund } from "../src/domain/refund";
import type { CreatePaymentAttemptInput, PaymentAttemptRepository } from "../src/application/payment-attempt-repository";
import type { PaymentProvider, ProviderCaptureInput, ProviderCaptureResult, ProviderRefundInput, ProviderRefundResult } from "../src/application/payment-provider";

export const fakeDb = {} as TenantDb;

export class FakePaymentAttemptRepository implements PaymentAttemptRepository {
  private readonly byId = new Map<string, PaymentAttempt>();

  async findByIdempotencyKey(_db: TenantDb, idempotencyKey: string): Promise<PaymentAttempt | undefined> {
    return [...this.byId.values()].find((a) => a.idempotencyKey === idempotencyKey);
  }

  async findById(_db: TenantDb, id: string): Promise<PaymentAttempt | undefined> {
    return this.byId.get(id);
  }

  async create(_db: TenantDb, input: CreatePaymentAttemptInput): Promise<PaymentAttempt> {
    const now = new Date();
    const attempt: PaymentAttempt = { id: randomUUID(), refundedAmountCents: 0, createdAt: now, updatedAt: now, ...input };
    this.byId.set(attempt.id, attempt);
    return attempt;
  }

  async applyRefund(
    _db: TenantDb,
    input: { paymentAttemptId: string; amountCents: number; reason: string | null; providerRefundId: string },
  ): Promise<{ paymentAttempt: PaymentAttempt; refund: Refund }> {
    const existing = this.byId.get(input.paymentAttemptId);
    if (!existing) throw new Error(`Payment attempt not found: ${input.paymentAttemptId}`);

    const remaining = existing.capturedAmountCents - existing.refundedAmountCents;
    if (input.amountCents > remaining) {
      throw new RefundExceedsCapturedAmountError(existing.id, input.amountCents, remaining);
    }

    const refundedAmountCents = existing.refundedAmountCents + input.amountCents;
    const status: PaymentAttemptStatus = refundedAmountCents >= existing.capturedAmountCents ? "refunded" : "partially_refunded";
    const updated: PaymentAttempt = { ...existing, refundedAmountCents, status, updatedAt: new Date() };
    this.byId.set(updated.id, updated);

    const refund: Refund = {
      id: randomUUID(),
      paymentAttemptId: existing.id,
      amountCents: input.amountCents,
      reason: input.reason,
      providerRefundId: input.providerRefundId,
      createdAt: new Date(),
    };
    return { paymentAttempt: updated, refund };
  }
}

export class FakePaymentProvider implements PaymentProvider {
  readonly id: string;
  public captureCalls: ProviderCaptureInput[] = [];
  public refundCalls: ProviderRefundInput[] = [];

  constructor(
    id = "fake",
    private readonly captureResult: ProviderCaptureResult = { success: true, providerTransactionId: "FAKE-TX-1" },
    private readonly refundResult: ProviderRefundResult = { success: true, providerRefundId: "FAKE-REFUND-1" },
  ) {
    this.id = id;
  }

  async capture(input: ProviderCaptureInput): Promise<ProviderCaptureResult> {
    this.captureCalls.push(input);
    return this.captureResult;
  }

  async refund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    this.refundCalls.push(input);
    return this.refundResult;
  }
}
