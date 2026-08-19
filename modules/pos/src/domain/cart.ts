import type { CartLine } from "./cart-line";

export type CartStatus = "open" | "completed" | "abandoned";

export interface Cart {
  id: string;
  terminalId: string;
  /** No Customer entity exists yet (sales module, not implemented) — stored as a plain reference, unvalidated. */
  customerId: string | null;
  status: CartStatus;
  lines: CartLine[];
  createdAt: Date;
  updatedAt: Date;
}

export class CartNotFoundError extends Error {
  constructor(id: string) {
    super(`Cart not found: ${id}`);
    this.name = "CartNotFoundError";
  }
}

export class CartNotOpenError extends Error {
  constructor(id: string, status: CartStatus) {
    super(`Cart ${id} is not open (status: ${status})`);
    this.name = "CartNotOpenError";
  }
}

export class EmptyCartError extends Error {
  constructor(id: string) {
    super(`Cart ${id} has no line items`);
    this.name = "EmptyCartError";
  }
}
