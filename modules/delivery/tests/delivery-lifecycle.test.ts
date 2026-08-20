import { describe, expect, it } from "vitest";
import { assignDriver } from "../src/application/assign-driver";
import { completeDelivery } from "../src/application/complete-delivery";
import { failDelivery, DeliveryNotFailableError } from "../src/application/fail-delivery";
import { DriverNotActiveError, DriverNotFoundError } from "../src/domain/driver";
import { DeliveryNotAssignableError, DeliveryNotCompletableError, DeliveryNotFoundError } from "../src/domain/delivery";
import { FakeDeliveryAssignmentRepository, FakeDeliveryRepository, FakeDriverRepository, fakeDb } from "./fakes";

function deps() {
  const deliveryRepository = new FakeDeliveryRepository();
  const driverRepository = new FakeDriverRepository();
  const assignmentRepository = new FakeDeliveryAssignmentRepository();
  return { deliveryRepository, driverRepository, assignmentRepository };
}

describe("assignDriver", () => {
  it("assigns an active driver to a pending delivery", async () => {
    const d = deps();
    const delivery = d.deliveryRepository.seed({ orderReference: "order-1", status: "pending", driverId: null });
    const driver = d.driverRepository.seed({ name: "Alex", status: "active" });

    const updated = await assignDriver(d, fakeDb, { deliveryId: delivery.id, driverId: driver.id });

    expect(updated.status).toBe("assigned");
    expect(updated.driverId).toBe(driver.id);
    expect(d.assignmentRepository.assignments).toHaveLength(1);
  });

  it("records reassignment history, closing the prior open assignment", async () => {
    const d = deps();
    const delivery = d.deliveryRepository.seed({ orderReference: "order-1", status: "failed", driverId: null });
    const first = d.driverRepository.seed({ name: "Alex", status: "active" });
    const second = d.driverRepository.seed({ name: "Sam", status: "active" });

    await assignDriver(d, fakeDb, { deliveryId: delivery.id, driverId: first.id });
    await assignDriver(d, fakeDb, { deliveryId: delivery.id, driverId: second.id });

    const history = await d.assignmentRepository.listByDelivery(fakeDb, delivery.id);
    expect(history).toHaveLength(2);
    expect(history[0]?.unassignedAt).not.toBeNull(); // closed
    expect(history[1]?.unassignedAt).toBeNull(); // currently open
  });

  it("allows reassigning a delivery that already has a driver (a dispatcher swap, not a failure)", async () => {
    const d = deps();
    const first = d.driverRepository.seed({ name: "Alex", status: "active" });
    const second = d.driverRepository.seed({ name: "Sam", status: "active" });
    const delivery = d.deliveryRepository.seed({ orderReference: "order-1", status: "assigned", driverId: first.id });

    const updated = await assignDriver(d, fakeDb, { deliveryId: delivery.id, driverId: second.id });
    expect(updated.driverId).toBe(second.id);
  });

  it("rejects assigning to a completed delivery", async () => {
    const d = deps();
    const driver = d.driverRepository.seed({ name: "Alex", status: "active" });
    const delivery = d.deliveryRepository.seed({ orderReference: "order-1", status: "completed", driverId: driver.id });

    await expect(assignDriver(d, fakeDb, { deliveryId: delivery.id, driverId: driver.id })).rejects.toThrow(DeliveryNotAssignableError);
  });

  it("rejects assigning an inactive driver", async () => {
    const d = deps();
    const delivery = d.deliveryRepository.seed({ orderReference: "order-1", status: "pending", driverId: null });
    const driver = d.driverRepository.seed({ name: "Alex", status: "inactive" });

    await expect(assignDriver(d, fakeDb, { deliveryId: delivery.id, driverId: driver.id })).rejects.toThrow(DriverNotActiveError);
  });

  it("throws DeliveryNotFoundError / DriverNotFoundError for unknown ids", async () => {
    const d = deps();
    const driver = d.driverRepository.seed({ name: "Alex", status: "active" });
    await expect(assignDriver(d, fakeDb, { deliveryId: "nope", driverId: driver.id })).rejects.toThrow(DeliveryNotFoundError);

    const delivery = d.deliveryRepository.seed({ orderReference: "order-1", status: "pending", driverId: null });
    await expect(assignDriver(d, fakeDb, { deliveryId: delivery.id, driverId: "nope" })).rejects.toThrow(DriverNotFoundError);
  });
});

describe("completeDelivery", () => {
  it("completes an assigned delivery", async () => {
    const deliveryRepository = new FakeDeliveryRepository();
    const driver = { id: "driver-1" };
    const delivery = deliveryRepository.seed({ orderReference: "order-1", status: "assigned", driverId: driver.id });

    const completed = await completeDelivery(deliveryRepository, fakeDb, delivery.id);
    expect(completed.status).toBe("completed");
  });

  it("rejects completing a delivery that was never assigned", async () => {
    const deliveryRepository = new FakeDeliveryRepository();
    const delivery = deliveryRepository.seed({ orderReference: "order-1", status: "pending", driverId: null });
    await expect(completeDelivery(deliveryRepository, fakeDb, delivery.id)).rejects.toThrow(DeliveryNotCompletableError);
  });
});

describe("failDelivery", () => {
  it("marks an assigned delivery failed, which can then be reassigned", async () => {
    const d = deps();
    const driver = d.driverRepository.seed({ name: "Alex", status: "active" });
    const other = d.driverRepository.seed({ name: "Sam", status: "active" });
    const delivery = d.deliveryRepository.seed({ orderReference: "order-1", status: "assigned", driverId: driver.id });

    const failed = await failDelivery(d.deliveryRepository, fakeDb, delivery.id);
    expect(failed.status).toBe("failed");

    const retried = await assignDriver(d, fakeDb, { deliveryId: delivery.id, driverId: other.id });
    expect(retried.status).toBe("assigned");
    expect(retried.driverId).toBe(other.id);
  });

  it("rejects marking an already-completed delivery failed", async () => {
    const deliveryRepository = new FakeDeliveryRepository();
    const delivery = deliveryRepository.seed({ orderReference: "order-1", status: "completed", driverId: "driver-1" });
    await expect(failDelivery(deliveryRepository, fakeDb, delivery.id)).rejects.toThrow(DeliveryNotFailableError);
  });
});
