import type { TenantDb } from "@erp/database";
import { DriverNotActiveError, DriverNotFoundError } from "../domain/driver";
import { DeliveryNotAssignableError, DeliveryNotFoundError, type Delivery } from "../domain/delivery";
import type { DeliveryAssignmentRepository } from "./delivery-assignment-repository";
import type { DeliveryRepository } from "./delivery-repository";
import type { DriverRepository } from "./driver-repository";

export interface AssignDriverDependencies {
  deliveryRepository: DeliveryRepository;
  driverRepository: DriverRepository;
  assignmentRepository: DeliveryAssignmentRepository;
}

export interface AssignDriverInput {
  deliveryId: string;
  driverId: string;
}

/**
 * Assignable from 'pending' (first assignment), 'assigned' (a dispatcher
 * swapping drivers before completion — a normal operation, not a
 * failure), or 'failed' (a retry/reassign after a prior failure,
 * CLAUDE.md §34) — not from 'completed' (terminal).
 */
export async function assignDriver(dependencies: AssignDriverDependencies, db: TenantDb, input: AssignDriverInput): Promise<Delivery> {
  const delivery = await dependencies.deliveryRepository.findById(db, input.deliveryId);
  if (!delivery) throw new DeliveryNotFoundError(input.deliveryId);
  if (delivery.status === "completed") {
    throw new DeliveryNotAssignableError(delivery.id, delivery.status);
  }

  const driver = await dependencies.driverRepository.findById(db, input.driverId);
  if (!driver) throw new DriverNotFoundError(input.driverId);
  if (driver.status !== "active") throw new DriverNotActiveError(driver.id);

  await dependencies.assignmentRepository.createAssignment(db, { deliveryId: delivery.id, driverId: driver.id });
  return dependencies.deliveryRepository.setDriverAndStatus(db, delivery.id, driver.id, "assigned");
}
