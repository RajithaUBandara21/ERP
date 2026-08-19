import type { CartLine } from "./cart-line";

export type PosTransactionStatus = "completed" | "voided";

export interface PosTransaction {
  id: string;
  terminalId: string;
  cartId: string | null;
  customerId: string | null;
  lines: CartLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** No real payment provider abstraction yet (Phase 10) — a plain descriptive string for now. */
  paymentMethod: string;
  /** CLAUDE.md §19 — e.g. "POS-TERM-001-20260819-000123". Enforces retry-safety at the database level (unique constraint), not just in application logic. */
  idempotencyKey: string;
  status: PosTransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class TransactionNotFoundError extends Error {
  constructor(identifier: string) {
    super(`POS transaction not found: ${identifier}`);
    this.name = "TransactionNotFoundError";
  }
}
