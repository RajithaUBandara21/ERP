import type { TenantDb } from "@erp/database";
import { and, eq } from "drizzle-orm";
import { InsufficientStockError } from "../domain/errors";
import { toStockLevel, type StockLevel } from "../domain/stock-level";
import type { ApplyMovementInput, StockRepository } from "../application/stock-repository";
import { stockLevels, stockMovements } from "./persistence/schema";

export class DrizzleStockRepository implements StockRepository {
  async getLevel(db: TenantDb, warehouseId: string, sku: string): Promise<StockLevel | undefined> {
    const [row] = await db
      .select()
      .from(stockLevels)
      .where(and(eq(stockLevels.warehouseId, warehouseId), eq(stockLevels.sku, sku)))
      .limit(1);
    return row ? toStockLevel(row) : undefined;
  }

  /**
   * Ensures the (warehouseId, sku) row exists first (race-safe via the
   * unique index on those columns, ON CONFLICT DO NOTHING), then locks it
   * with SELECT ... FOR UPDATE before computing the new totals — this is
   * what makes two concurrent terminals selling the last unit resolve
   * safely instead of both succeeding (CLAUDE.md §21).
   */
  async applyMovement(db: TenantDb, input: ApplyMovementInput): Promise<StockLevel> {
    return db.transaction(async (tx) => {
      await tx
        .insert(stockLevels)
        .values({ warehouseId: input.warehouseId, sku: input.sku, onHand: 0, reserved: 0 })
        .onConflictDoNothing({ target: [stockLevels.warehouseId, stockLevels.sku] });

      const [existing] = await tx
        .select()
        .from(stockLevels)
        .where(and(eq(stockLevels.warehouseId, input.warehouseId), eq(stockLevels.sku, input.sku)))
        .for("update");
      if (!existing) throw new Error("Failed to resolve stock level row");

      const nextOnHand = existing.onHand + input.onHandDelta;
      const nextReserved = existing.reserved + input.reservedDelta;

      if (nextOnHand < 0 || nextReserved < 0 || nextReserved > nextOnHand) {
        const requested = input.reservedDelta !== 0 ? input.reservedDelta : -input.onHandDelta;
        throw new InsufficientStockError(input.sku, input.warehouseId, requested, existing.onHand - existing.reserved);
      }

      const [row] = await tx
        .update(stockLevels)
        .set({ onHand: nextOnHand, reserved: nextReserved, updatedAt: new Date() })
        .where(eq(stockLevels.id, existing.id))
        .returning();
      if (!row) throw new Error("Failed to persist stock level");

      await tx.insert(stockMovements).values({
        warehouseId: input.warehouseId,
        sku: input.sku,
        type: input.type,
        onHandDelta: input.onHandDelta,
        reservedDelta: input.reservedDelta,
        reference: input.reference ?? null,
      });

      return toStockLevel(row);
    });
  }
}
