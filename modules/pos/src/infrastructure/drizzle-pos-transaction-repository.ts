import type { TenantDb } from "@erp/database";
import { eq } from "drizzle-orm";
import type { PosTransaction, PosTransactionStatus } from "../domain/pos-transaction";
import type { CreatePosTransactionInput, PosTransactionRepository } from "../application/pos-transaction-repository";
import { posTransactions } from "./persistence/schema";

function toDomain(row: typeof posTransactions.$inferSelect): PosTransaction {
  return {
    id: row.id,
    terminalId: row.terminalId,
    cartId: row.cartId,
    customerId: row.customerId,
    lines: row.lines,
    subtotalCents: row.subtotalCents,
    taxCents: row.taxCents,
    totalCents: row.totalCents,
    paymentMethod: row.paymentMethod,
    idempotencyKey: row.idempotencyKey,
    status: row.status as PosTransactionStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePosTransactionRepository implements PosTransactionRepository {
  async findByIdempotencyKey(db: TenantDb, idempotencyKey: string): Promise<PosTransaction | undefined> {
    const [row] = await db
      .select()
      .from(posTransactions)
      .where(eq(posTransactions.idempotencyKey, idempotencyKey))
      .limit(1);
    return row ? toDomain(row) : undefined;
  }

  async create(db: TenantDb, input: CreatePosTransactionInput): Promise<PosTransaction> {
    const [row] = await db.insert(posTransactions).values(input).returning();
    if (!row) throw new Error("Failed to create POS transaction");
    return toDomain(row);
  }
}
