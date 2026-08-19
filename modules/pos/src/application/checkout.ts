import { idempotencyKeySchema } from "@erp/validation";
import type { TenantDb } from "@erp/database";
import { CartNotFoundError, CartNotOpenError, EmptyCartError } from "../domain/cart";
import { lineTotalCents } from "../domain/cart-line";
import type { PosTransaction } from "../domain/pos-transaction";
import type { CartRepository } from "./cart-repository";
import type { PaymentCapturePort } from "./payment-capture-port";
import type { PosTransactionRepository } from "./pos-transaction-repository";
import type { StockReservationPort } from "./stock-reservation-port";

export class PaymentCaptureFailedError extends Error {
  constructor() {
    super("Payment capture failed");
    this.name = "PaymentCaptureFailedError";
  }
}

export interface CheckoutDependencies {
  cartRepository: CartRepository;
  transactionRepository: PosTransactionRepository;
  stockReservationPort: StockReservationPort;
  paymentCapturePort: PaymentCapturePort;
}

export interface CheckoutInput {
  cartId: string;
  idempotencyKey: string;
  paymentMethod: string;
  /** No tax engine exists yet — defaults to 0; a caller (or a future tax module) can pass a computed value. */
  taxCents?: number;
}

/**
 * CLAUDE.md §22's "transactional database operations + idempotency +
 * outbox + compensating actions" for cross-module workflows. Idempotency
 * and the DB write are implemented. Compensating actions are NOT yet: with
 * the current no-op ports (see stock-reservation-port.ts,
 * payment-capture-port.ts) there's nothing to compensate, but once Phase 9/10
 * wire real implementations, a reserveStock() that succeeds followed by a
 * capturePayment() that fails needs an explicit stock-release compensating
 * call here — tracked as a known gap, not silently forgotten.
 */
export async function checkout(
  dependencies: CheckoutDependencies,
  db: TenantDb,
  tenantId: string,
  input: CheckoutInput,
): Promise<PosTransaction> {
  const idempotencyKey = idempotencyKeySchema.parse(input.idempotencyKey);

  // Idempotency first — a retried checkout with the same key returns the
  // original result without re-running any side effect below (CLAUDE.md §19).
  const existing = await dependencies.transactionRepository.findByIdempotencyKey(db, idempotencyKey);
  if (existing) return existing;

  const cart = await dependencies.cartRepository.findById(db, input.cartId);
  if (!cart) throw new CartNotFoundError(input.cartId);
  if (cart.status !== "open") throw new CartNotOpenError(input.cartId, cart.status);
  if (cart.lines.length === 0) throw new EmptyCartError(input.cartId);

  const subtotalCents = cart.lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
  const taxCents = input.taxCents ?? 0;
  const totalCents = subtotalCents + taxCents;

  await dependencies.stockReservationPort.reserveStock(tenantId, cart.lines);

  const paymentResult = await dependencies.paymentCapturePort.capturePayment(tenantId, totalCents, input.paymentMethod);
  if (!paymentResult.success) {
    throw new PaymentCaptureFailedError();
  }

  const transaction = await dependencies.transactionRepository.create(db, {
    terminalId: cart.terminalId,
    cartId: cart.id,
    customerId: cart.customerId,
    lines: cart.lines,
    subtotalCents,
    taxCents,
    totalCents,
    paymentMethod: input.paymentMethod,
    idempotencyKey,
  });

  await dependencies.cartRepository.setStatus(db, cart.id, "completed");

  return transaction;
}
