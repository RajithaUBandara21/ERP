import type { TenantDb } from "@erp/database";
import type { Cart, CartStatus } from "../domain/cart";
import type { CartLine } from "../domain/cart-line";

export interface CartRepository {
  findById(db: TenantDb, id: string): Promise<Cart | undefined>;
  create(db: TenantDb, input: { terminalId: string; customerId: string | null }): Promise<Cart>;
  setLines(db: TenantDb, id: string, lines: CartLine[]): Promise<void>;
  setStatus(db: TenantDb, id: string, status: CartStatus): Promise<void>;
}
