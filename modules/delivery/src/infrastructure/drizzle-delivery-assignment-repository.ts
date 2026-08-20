import type { TenantDb } from "@erp/database";
import { and, eq, isNull } from "drizzle-orm";
import type { DeliveryAssignment } from "../domain/delivery-assignment";
import type { DeliveryAssignmentRepository } from "../application/delivery-assignment-repository";
import { deliveryAssignments } from "./persistence/schema";

function toDomain(row: typeof deliveryAssignments.$inferSelect): DeliveryAssignment {
  return {
    id: row.id,
    deliveryId: row.deliveryId,
    driverId: row.driverId,
    assignedAt: row.assignedAt,
    unassignedAt: row.unassignedAt,
  };
}

export class DrizzleDeliveryAssignmentRepository implements DeliveryAssignmentRepository {
  async createAssignment(db: TenantDb, input: { deliveryId: string; driverId: string }): Promise<DeliveryAssignment> {
    return db.transaction(async (tx) => {
      await tx
        .update(deliveryAssignments)
        .set({ unassignedAt: new Date() })
        .where(and(eq(deliveryAssignments.deliveryId, input.deliveryId), isNull(deliveryAssignments.unassignedAt)));

      const [row] = await tx.insert(deliveryAssignments).values(input).returning();
      if (!row) throw new Error("Failed to create delivery assignment");
      return toDomain(row);
    });
  }

  async listByDelivery(db: TenantDb, deliveryId: string): Promise<DeliveryAssignment[]> {
    const rows = await db.select().from(deliveryAssignments).where(eq(deliveryAssignments.deliveryId, deliveryId));
    return rows.map(toDomain);
  }
}
