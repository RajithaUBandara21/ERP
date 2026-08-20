import { idempotencyKeySchema } from "@erp/validation";
import type { TenantDb } from "@erp/database";
import { UnsupportedPaymentMethodError } from "../domain/errors";
import type { PaymentAttempt } from "../domain/payment-attempt";
import type { PaymentAttemptRepository } from "./payment-attempt-repository";
import type { PaymentProvider } from "./payment-provider";

export interface CapturePaymentDependencies {
  paymentAttemptRepository: PaymentAttemptRepository;
  /** method (e.g. "cash", "card") → provider. Unknown methods throw UnsupportedPaymentMethodError. */
  providers: Record<string, PaymentProvider>;
}

export interface CapturePaymentInput {
  reference: string;
  method: string;
  amountCents: number;
  idempotencyKey: string;
  paymentMethodToken?: string;
}

/**
 * Idempotent on idempotencyKey (CLAUDE.md §19), same pattern as
 * modules/pos's checkout(): a retried capture with the same key returns
 * the original attempt without calling the provider again — critical for
 * payments specifically, since a blindly-retried capture could charge a
 * customer twice (CLAUDE.md §63: "never retry payments blindly").
 */
export async function capturePayment(
  dependencies: CapturePaymentDependencies,
  db: TenantDb,
  input: CapturePaymentInput,
): Promise<PaymentAttempt> {
  const idempotencyKey = idempotencyKeySchema.parse(input.idempotencyKey);

  const existing = await dependencies.paymentAttemptRepository.findByIdempotencyKey(db, idempotencyKey);
  if (existing) return existing;

  const provider = dependencies.providers[input.method];
  if (!provider) throw new UnsupportedPaymentMethodError(input.method);

  const result = await provider.capture({
    amountCents: input.amountCents,
    ...(input.paymentMethodToken !== undefined ? { paymentMethodToken: input.paymentMethodToken } : {}),
  });

  return dependencies.paymentAttemptRepository.create(db, {
    reference: input.reference,
    method: input.method,
    provider: provider.id,
    amountCents: input.amountCents,
    capturedAmountCents: result.success ? input.amountCents : 0,
    providerTransactionId: result.providerTransactionId,
    idempotencyKey,
    status: result.success ? "succeeded" : "failed",
  });
}
