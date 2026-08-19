import type { TenantDb } from "@erp/database";
import type { Cart } from "../domain/cart";
import { TerminalNotActiveError, TerminalNotFoundError } from "../domain/terminal";
import type { CartRepository } from "./cart-repository";
import type { TerminalRepository } from "./terminal-repository";

export async function createCart(
  cartRepository: CartRepository,
  terminalRepository: TerminalRepository,
  db: TenantDb,
  input: { terminalId: string; customerId?: string },
): Promise<Cart> {
  const terminal = await terminalRepository.findById(db, input.terminalId);
  if (!terminal) throw new TerminalNotFoundError(input.terminalId);
  if (terminal.status !== "active") throw new TerminalNotActiveError(input.terminalId);

  return cartRepository.create(db, { terminalId: input.terminalId, customerId: input.customerId ?? null });
}
