import { randomUUID } from "node:crypto";
import type { TenantDb } from "@erp/database";
import { CartNotFoundError, CartNotOpenError, type Cart } from "../domain/cart";
import type { CartRepository } from "./cart-repository";

export interface AddCartLineInput {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

/** Scanning/adding a SKU already in the cart merges quantities rather than creating a duplicate line — matches CLAUDE.md §36's "scan barcode → add product → change quantity" flow. */
export async function addCartLine(repository: CartRepository, db: TenantDb, cartId: string, input: AddCartLineInput): Promise<Cart> {
  const cart = await repository.findById(db, cartId);
  if (!cart) throw new CartNotFoundError(cartId);
  if (cart.status !== "open") throw new CartNotOpenError(cartId, cart.status);
  if (input.quantity <= 0) throw new Error("Quantity must be positive");

  const existing = cart.lines.find((line) => line.sku === input.sku);
  const lines = existing
    ? cart.lines.map((line) => (line.sku === input.sku ? { ...line, quantity: line.quantity + input.quantity } : line))
    : [...cart.lines, { id: randomUUID(), sku: input.sku, name: input.name, quantity: input.quantity, unitPriceCents: input.unitPriceCents }];

  await repository.setLines(db, cartId, lines);
  return { ...cart, lines };
}
