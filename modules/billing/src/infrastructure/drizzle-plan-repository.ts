import { getControlPlaneDb, schema } from "@erp/database";
import { eq } from "drizzle-orm";
import type { BillingInterval, Plan } from "../domain/plan";
import type { PlanRepository } from "../application/plan-repository";

function toDomainPlan(row: typeof schema.plans.$inferSelect): Plan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    includedModules: row.includedModules,
    userLimit: row.userLimit,
    priceCents: row.priceCents,
    billingInterval: row.billingInterval as BillingInterval,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePlanRepository implements PlanRepository {
  async findByCode(code: string): Promise<Plan | undefined> {
    const db = getControlPlaneDb();
    const [row] = await db.select().from(schema.plans).where(eq(schema.plans.code, code)).limit(1);
    return row ? toDomainPlan(row) : undefined;
  }

  async findById(id: string): Promise<Plan | undefined> {
    const db = getControlPlaneDb();
    const [row] = await db.select().from(schema.plans).where(eq(schema.plans.id, id)).limit(1);
    return row ? toDomainPlan(row) : undefined;
  }

  async list(): Promise<Plan[]> {
    const db = getControlPlaneDb();
    const rows = await db.select().from(schema.plans);
    return rows.map(toDomainPlan);
  }

  async upsert(input: {
    code: string;
    name: string;
    includedModules: string[];
    userLimit: number | null;
    priceCents: number;
    billingInterval: BillingInterval;
  }): Promise<Plan> {
    const db = getControlPlaneDb();
    const [row] = await db
      .insert(schema.plans)
      .values(input)
      .onConflictDoUpdate({
        target: schema.plans.code,
        set: {
          name: input.name,
          includedModules: input.includedModules,
          userLimit: input.userLimit,
          priceCents: input.priceCents,
          billingInterval: input.billingInterval,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toDomainPlan(row!);
  }
}
