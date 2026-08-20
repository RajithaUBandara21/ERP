import type { TenantDb } from "@erp/database";
import { eq } from "drizzle-orm";
import { RefundExceedsCapturedAmountError } from "../domain/errors";
import type { PaymentAttempt, PaymentAttemptStatus } from "../domain/payment-attempt";
import type { Refund } from "../domain/refund";
import type { CreatePaymentAttemptInput, PaymentAttemptRepository } from "../application/payment-attempt-repository";
import { paymentAttempts, refunds } from "./persistence/schema";

function toDomain(row: typeof paymentAttempts.$inferSelect): PaymentAttempt {
  return {
    id: row.id,
    reference: row.reference,
    method: row.method,
    provider: row.provider,
    amountCents: row.amountCents,
    capturedAmountCents: row.capturedAmountCents,
    refundedAmountCents: row.refundedAmountCents,
    providerTransactionId: row.providerTransactionId,
    idempotencyKey: row.idempotencyKey,
    status: row.status as PaymentAttemptStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRefundDomain(row: typeof refunds.$inferSelect): Refund {
  return {
    id: row.id,
    paymentAttemptId: row.paymentAttemptId,
    amountCents: row.amountCents,
    reason: row.reason,
    providerRefundId: row.providerRefundId,
    createdAt: row.createdAt,
  };
}

export class DrizzlePaymentAttemptRepository implements PaymentAttemptRepository {
  async findByIdempotencyKey(db: TenantDb, idempotencyKey: string): Promise<PaymentAttempt | undefined> {
    const [row] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.idempotencyKey, idempotencyKey)).limit(1);
    return row ? toDomain(row) : undefined;
  }

  async findById(db: TenantDb, id: string): Promise<PaymentAttempt | undefined> {
    const [row] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, id)).limit(1);
    return row ? toDomain(row) : undefined;
  }

  async create(db: TenantDb, input: CreatePaymentAttemptInput): Promise<PaymentAttempt> {
    const [row] = await db.insert(paymentAttempts).values(input).returning();
    if (!row) throw new Error("Failed to create payment attempt");
    return toDomain(row);
  }

  async applyRefund(
    db: TenantDb,
    input: { paymentAttemptId: string; amountCents: number; reason: string | null; providerRefundId: string },
  ): Promise<{ paymentAttempt: PaymentAttempt; refund: Refund }> {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, input.paymentAttemptId)).for("update");
      if (!existing) throw new Error(`Payment attempt not found: ${input.paymentAttemptId}`);

      const remaining = existing.capturedAmountCents - existing.refundedAmountCents;
      if (input.amountCents > remaining) {
        throw new RefundExceedsCapturedAmountError(existing.id, input.amountCents, remaining);
      }

      const nextRefundedAmountCents = existing.refundedAmountCents + input.amountCents;
      const nextStatus: PaymentAttemptStatus = nextRefundedAmountCents >= existing.capturedAmountCents ? "refunded" : "partially_refunded";

      const [updated] = await tx
        .update(paymentAttempts)
        .set({ refundedAmountCents: nextRefundedAmountCents, status: nextStatus, updatedAt: new Date() })
        .where(eq(paymentAttempts.id, existing.id))
        .returning();
      if (!updated) throw new Error("Failed to update payment attempt");

      const [refundRow] = await tx
        .insert(refunds)
        .values({
          paymentAttemptId: existing.id,
          amountCents: input.amountCents,
          reason: input.reason,
          providerRefundId: input.providerRefundId,
        })
        .returning();
      if (!refundRow) throw new Error("Failed to create refund");

      return { paymentAttempt: toDomain(updated), refund: toRefundDomain(refundRow) };
    });
  }
}
