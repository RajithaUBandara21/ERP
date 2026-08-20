import type { TenantDb } from "@erp/database";
import { DeliveryNotFoundError, type Delivery, type DeliveryStatus } from "../domain/delivery";
import type { DeliveryRepository } from "./delivery-repository";

export class DeliveryNotFailableError extends Error {
  constructor(id: string, status: DeliveryStatus) {
    super(`Delivery ${id} cannot be marked failed from status '${status}'`);
    this.name = "DeliveryNotFailableError";
  }
}

/**
 * A third-party/driver failure must never corrupt the underlying order
 * (CLAUDE.md §34) — this only changes delivery's own state. A failed
 * delivery can be retried via assignDriver() (assignable from 'failed').
 */
export async function failDelivery(repository: DeliveryRepository, db: TenantDb, deliveryId: string): Promise<Delivery> {
  const delivery = await repository.findById(db, deliveryId);
  if (!delivery) throw new DeliveryNotFoundError(deliveryId);
  if (delivery.status !== "assigned" && delivery.status !== "pending") {
    throw new DeliveryNotFailableError(delivery.id, delivery.status);
  }

  return repository.setDriverAndStatus(db, delivery.id, delivery.driverId, "failed");
}
