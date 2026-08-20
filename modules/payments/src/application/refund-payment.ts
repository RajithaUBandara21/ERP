import type { TenantDb } from "@erp/database";
import { PaymentAttemptNotFoundError } from "../domain/payment-attempt";
import { PaymentAttemptNotSucceededError, ProviderError, RefundExceedsCapturedAmountError } from "../domain/errors";
import type { PaymentAttempt } from "../domain/payment-attempt";
import type { Refund } from "../domain/refund";
import type { PaymentAttemptRepository } from "./payment-attempt-repository";
import type { PaymentProvider } from "./payment-provider";

export interface RefundPaymentDependencies {
  paymentAttemptRepository: PaymentAttemptRepository;
  providers: Record<string, PaymentProvider>;
}

export interface RefundPaymentInput {
  paymentAttemptId: string;
  amountCents: number;
  reason?: string;
}

export async function refundPayment(
  dependencies: RefundPaymentDependencies,
  db: TenantDb,
  input: RefundPaymentInput,
): Promise<{ paymentAttempt: PaymentAttempt; refund: Refund }> {
  if (input.amountCents <= 0) throw new RangeError("amountCents must be positive");

  const attempt = await dependencies.paymentAttemptRepository.findById(db, input.paymentAttemptId);
  if (!attempt) throw new PaymentAttemptNotFoundError(input.paymentAttemptId);
  if (attempt.status !== "succeeded" && attempt.status !== "partially_refunded") {
    throw new PaymentAttemptNotSucceededError(attempt.id);
  }

  const provider = dependencies.providers[attempt.method];
  if (!provider) throw new ProviderError(attempt.provider, `no provider registered for method '${attempt.method}'`);

  // Validated again inside applyRefund under a row lock — this pre-check
  // just avoids calling the provider for a request that's obviously invalid.
  const remaining = attempt.capturedAmountCents - attempt.refundedAmountCents;
  if (input.amountCents > remaining) {
    throw new RefundExceedsCapturedAmountError(attempt.id, input.amountCents, remaining);
  }

  const result = await provider.refund({ providerTransactionId: attempt.providerTransactionId, amountCents: input.amountCents });
  if (!result.success) {
    throw new ProviderError(provider.id, result.failureReason ?? "refund declined");
  }

  return dependencies.paymentAttemptRepository.applyRefund(db, {
    paymentAttemptId: attempt.id,
    amountCents: input.amountCents,
    reason: input.reason ?? null,
    providerRefundId: result.providerRefundId,
  });
}
