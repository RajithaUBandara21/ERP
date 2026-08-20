import type { TenantDb } from "@erp/database";
import { PaymentAttemptNotFoundError, type PaymentAttempt } from "../domain/payment-attempt";
import type { PaymentAttemptRepository } from "./payment-attempt-repository";

export async function getPaymentAttempt(repository: PaymentAttemptRepository, db: TenantDb, id: string): Promise<PaymentAttempt> {
  const attempt = await repository.findById(db, id);
  if (!attempt) throw new PaymentAttemptNotFoundError(id);
  return attempt;
}
