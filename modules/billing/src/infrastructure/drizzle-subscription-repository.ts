import { getControlPlaneDb, schema } from "@erp/database";
import { eq } from "drizzle-orm";
import type { Subscription, SubscriptionStatus } from "../domain/subscription";
import type { SubscriptionRepository } from "../application/subscription-repository";

function toDomainSubscription(row: typeof schema.subscriptions.$inferSelect): Subscription {
  return {
    id: row.id,
    tenantId: row.tenantId,
    planId: row.planId,
    status: row.status as SubscriptionStatus,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  async findForTenant(tenantId: string): Promise<Subscription | undefined> {
    const db = getControlPlaneDb();
    const [row] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.tenantId, tenantId)).limit(1);
    return row ? toDomainSubscription(row) : undefined;
  }

  /** Idempotent under concurrent callers: relies on the DB-level unique tenant_id index, not a check-then-insert race — same pattern as DrizzleTenantRepository.create. */
  async create(input: { tenantId: string; planId: string }): Promise<Subscription> {
    const db = getControlPlaneDb();
    const [row] = await db
      .insert(schema.subscriptions)
      .values(input)
      .onConflictDoNothing({ target: schema.subscriptions.tenantId })
      .returning();

    if (row) return toDomainSubscription(row);

    const existing = await this.findForTenant(input.tenantId);
    if (!existing) {
      throw new Error(`Failed to create or load subscription for tenant ${input.tenantId}`);
    }
    return existing;
  }

  async updateStatus(id: string, status: Subscription["status"]): Promise<void> {
    const db = getControlPlaneDb();
    await db.update(schema.subscriptions).set({ status, updatedAt: new Date() }).where(eq(schema.subscriptions.id, id));
  }
}
