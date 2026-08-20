import type { TenantDb } from "@erp/database";
import type { DeliveryAssignment } from "../domain/delivery-assignment";

export interface DeliveryAssignmentRepository {
  /** Closes (sets unassignedAt on) any currently-open assignment for this delivery, then creates a new open one. */
  createAssignment(db: TenantDb, input: { deliveryId: string; driverId: string }): Promise<DeliveryAssignment>;
  listByDelivery(db: TenantDb, deliveryId: string): Promise<DeliveryAssignment[]>;
}
