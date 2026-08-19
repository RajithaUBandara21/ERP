import type { TenantDb } from "@erp/database";
import { eq } from "drizzle-orm";
import type { Cart, CartStatus } from "../domain/cart";
import type { CartLine } from "../domain/cart-line";
import type { CartRepository } from "../application/cart-repository";
import { carts } from "./persistence/schema";

function toDomain(row: typeof carts.$inferSelect): Cart {
  return {
    id: row.id,
    terminalId: row.terminalId,
    customerId: row.customerId,
    status: row.status as CartStatus,
    lines: row.lines,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleCartRepository implements CartRepository {
  async findById(db: TenantDb, id: string): Promise<Cart | undefined> {
    const [row] = await db.select().from(carts).where(eq(carts.id, id)).limit(1);
    return row ? toDomain(row) : undefined;
  }

  async create(db: TenantDb, input: { terminalId: string; customerId: string | null }): Promise<Cart> {
    const [row] = await db.insert(carts).values(input).returning();
    if (!row) throw new Error("Failed to create cart");
    return toDomain(row);
  }

  async setLines(db: TenantDb, id: string, lines: CartLine[]): Promise<void> {
    await db.update(carts).set({ lines, updatedAt: new Date() }).where(eq(carts.id, id));
  }

  async setStatus(db: TenantDb, id: string, status: CartStatus): Promise<void> {
    await db.update(carts).set({ status, updatedAt: new Date() }).where(eq(carts.id, id));
  }
}
