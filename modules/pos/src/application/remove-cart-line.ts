import type { TenantDb } from "@erp/database";
import { CartNotFoundError, CartNotOpenError, type Cart } from "../domain/cart";
import type { CartRepository } from "./cart-repository";

export async function removeCartLine(repository: CartRepository, db: TenantDb, cartId: string, lineId: string): Promise<Cart> {
  const cart = await repository.findById(db, cartId);
  if (!cart) throw new CartNotFoundError(cartId);
  if (cart.status !== "open") throw new CartNotOpenError(cartId, cart.status);

  const lines = cart.lines.filter((line) => line.id !== lineId);
  await repository.setLines(db, cartId, lines);
  return { ...cart, lines };
}
