import type { TenantDb } from "@erp/database";
import type { Delivery } from "../domain/delivery";
import type { DeliveryRepository } from "./delivery-repository";

export interface CreateDeliveryInput {
  orderReference: string;
}

export async function createDelivery(repository: DeliveryRepository, db: TenantDb, input: CreateDeliveryInput): Promise<Delivery> {
  return repository.create(db, input);
}
