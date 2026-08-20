import type { TenantDb } from "@erp/database";
import { DeliveryNotCompletableError, DeliveryNotFoundError, type Delivery } from "../domain/delivery";
import type { DeliveryRepository } from "./delivery-repository";

export async function completeDelivery(repository: DeliveryRepository, db: TenantDb, deliveryId: string): Promise<Delivery> {
  const delivery = await repository.findById(db, deliveryId);
  if (!delivery) throw new DeliveryNotFoundError(deliveryId);
  if (delivery.status !== "assigned") throw new DeliveryNotCompletableError(delivery.id, delivery.status);

  return repository.setDriverAndStatus(db, delivery.id, delivery.driverId, "completed");
}
