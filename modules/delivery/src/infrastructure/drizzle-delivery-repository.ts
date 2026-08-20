import type { TenantDb } from "@erp/database";
import { eq } from "drizzle-orm";
import type { Delivery, DeliveryStatus } from "../domain/delivery";
import type { DeliveryRepository } from "../application/delivery-repository";
import { deliveries } from "./persistence/schema";

function toDomain(row: typeof deliveries.$inferSelect): Delivery {
  return {
    id: row.id,
    orderReference: row.orderReference,
    status: row.status as DeliveryStatus,
    driverId: row.driverId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleDeliveryRepository implements DeliveryRepository {
  async create(db: TenantDb, input: { orderReference: string }): Promise<Delivery> {
    const [row] = await db.insert(deliveries).values(input).returning();
    if (!row) throw new Error("Failed to create delivery");
    return toDomain(row);
  }

  async findById(db: TenantDb, id: string): Promise<Delivery | undefined> {
    const [row] = await db.select().from(deliveries).where(eq(deliveries.id, id)).limit(1);
    return row ? toDomain(row) : undefined;
  }

  async setDriverAndStatus(db: TenantDb, id: string, driverId: string | null, status: DeliveryStatus): Promise<Delivery> {
    const [row] = await db.update(deliveries).set({ driverId, status, updatedAt: new Date() }).where(eq(deliveries.id, id)).returning();
    if (!row) throw new Error(`Failed to update delivery: ${id}`);
    return toDomain(row);
  }

  async list(db: TenantDb): Promise<Delivery[]> {
    const rows = await db.select().from(deliveries);
    return rows.map(toDomain);
  }
}
