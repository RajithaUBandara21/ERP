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
  /** Opaque, already-tokenized reference — never raw card data (CLAUDE.md §33). Required by some providers (e.g. "card"), ignored by others (e.g. "cash"). */
  paymentMethodToken?: string;
  /** No tax engine exists yet — defaults to 0; a caller (or a future tax module) can pass a computed value. */
  taxCents?: number;
}

/**
 * CLAUDE.md §22's "transactional database operations + idempotency +
 * outbox + compensating actions" for cross-module workflows. Idempotency
 * and the DB write are implemented. The compensating action flagged as a
 * gap in Phase 8 (a reserveStock() that succeeds followed by a
 * capturePayment() that fails needs an explicit stock-release) is closed
 * now that Phase 9 wires a real StockReservationPort: on payment failure
 * this releases the reservation before rethrowing; on success it confirms
 * the reservation into an actual deduction.
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

  await dependencies.stockReservationPort.reserveStock(tenantId, cart.id, cart.lines);

  const paymentResult = await dependencies.paymentCapturePort.capturePayment(
    tenantId,
    idempotencyKey,
    totalCents,
    input.paymentMethod,
    input.paymentMethodToken,
  );
  if (!paymentResult.success) {
    // Compensating action: undo the reservation before surfacing the failure.
    await dependencies.stockReservationPort.releaseReservation(tenantId, cart.id, cart.lines);
    throw new PaymentCaptureFailedError();
  }

  await dependencies.stockReservationPort.confirmReservation(tenantId, cart.id, cart.lines);

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
