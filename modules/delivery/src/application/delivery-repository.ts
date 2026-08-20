import type { TenantDb } from "@erp/database";
import type { Delivery, DeliveryStatus } from "../domain/delivery";

export interface DeliveryRepository {
  create(db: TenantDb, input: { orderReference: string }): Promise<Delivery>;
  findById(db: TenantDb, id: string): Promise<Delivery | undefined>;
  setDriverAndStatus(db: TenantDb, id: string, driverId: string | null, status: DeliveryStatus): Promise<Delivery>;
  list(db: TenantDb): Promise<Delivery[]>;
}
