import { getControlPlaneDb, schema } from "@erp/database";
import { desc, eq } from "drizzle-orm";
import type { BillingCharge, BillingChargeStatus } from "../domain/billing-charge";
import type { BillingChargeRepository } from "../application/billing-charge-repository";

function toDomainCharge(row: typeof schema.billing.$inferSelect): BillingCharge {
  return {
    id: row.id,
    tenantId: row.tenantId,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status as BillingChargeStatus,
    issuedAt: row.issuedAt,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleBillingChargeRepository implements BillingChargeRepository {
  async create(input: { tenantId: string; amountCents: number; currency: string }): Promise<BillingCharge> {
    const db = getControlPlaneDb();
    const [row] = await db.insert(schema.billing).values(input).returning();
    return toDomainCharge(row!);
  }

  async markPaid(id: string): Promise<void> {
    const db = getControlPlaneDb();
    await db.update(schema.billing).set({ status: "paid", paidAt: new Date(), updatedAt: new Date() }).where(eq(schema.billing.id, id));
  }

  async markFailed(id: string): Promise<void> {
    const db = getControlPlaneDb();
    await db.update(schema.billing).set({ status: "failed", updatedAt: new Date() }).where(eq(schema.billing.id, id));
  }

  async listForTenant(tenantId: string): Promise<BillingCharge[]> {
    const db = getControlPlaneDb();
    const rows = await db.select().from(schema.billing).where(eq(schema.billing.tenantId, tenantId)).orderBy(desc(schema.billing.issuedAt));
    return rows.map(toDomainCharge);
  }
}
