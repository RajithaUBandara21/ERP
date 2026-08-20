import { randomUUID } from "node:crypto";
import type { TenantDb } from "@erp/database";
import type { Delivery, DeliveryStatus } from "../src/domain/delivery";
import type { DeliveryAssignment } from "../src/domain/delivery-assignment";
import type { Driver } from "../src/domain/driver";
import type { DeliveryAssignmentRepository } from "../src/application/delivery-assignment-repository";
import type { DeliveryRepository } from "../src/application/delivery-repository";
import type { DriverRepository } from "../src/application/driver-repository";

export const fakeDb = {} as TenantDb;

export class FakeDriverRepository implements DriverRepository {
  private readonly byId = new Map<string, Driver>();

  async create(_db: TenantDb, input: { name: string }): Promise<Driver> {
    const now = new Date();
    const driver: Driver = { id: randomUUID(), name: input.name, status: "active", createdAt: now, updatedAt: now };
    this.byId.set(driver.id, driver);
    return driver;
  }

  async findById(_db: TenantDb, id: string): Promise<Driver | undefined> {
    return this.byId.get(id);
  }

  async list(_db: TenantDb): Promise<Driver[]> {
    return [...this.byId.values()];
  }

  seed(driver: Omit<Driver, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Driver, "id">>): Driver {
    const now = new Date();
    const full: Driver = { ...driver, id: driver.id ?? randomUUID(), createdAt: now, updatedAt: now };
    this.byId.set(full.id, full);
    return full;
  }
}

export class FakeDeliveryRepository implements DeliveryRepository {
  private readonly byId = new Map<string, Delivery>();

  async create(_db: TenantDb, input: { orderReference: string }): Promise<Delivery> {
    const now = new Date();
    const delivery: Delivery = { id: randomUUID(), orderReference: input.orderReference, status: "pending", driverId: null, createdAt: now, updatedAt: now };
    this.byId.set(delivery.id, delivery);
    return delivery;
  }

  async findById(_db: TenantDb, id: string): Promise<Delivery | undefined> {
    return this.byId.get(id);
  }

  async setDriverAndStatus(_db: TenantDb, id: string, driverId: string | null, status: DeliveryStatus): Promise<Delivery> {
    const existing = this.byId.get(id);
    if (!existing) throw new Error(`Delivery not found: ${id}`);
    const updated: Delivery = { ...existing, driverId, status, updatedAt: new Date() };
    this.byId.set(id, updated);
    return updated;
  }

  async list(_db: TenantDb): Promise<Delivery[]> {
    return [...this.byId.values()];
  }

  seed(delivery: Omit<Delivery, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Delivery, "id">>): Delivery {
    const now = new Date();
    const full: Delivery = { ...delivery, id: delivery.id ?? randomUUID(), createdAt: now, updatedAt: now };
    this.byId.set(full.id, full);
    return full;
  }
}

export class FakeDeliveryAssignmentRepository implements DeliveryAssignmentRepository {
  public assignments: DeliveryAssignment[] = [];

  async createAssignment(_db: TenantDb, input: { deliveryId: string; driverId: string }): Promise<DeliveryAssignment> {
    for (const a of this.assignments) {
      if (a.deliveryId === input.deliveryId && a.unassignedAt === null) a.unassignedAt = new Date();
    }
    const assignment: DeliveryAssignment = { id: randomUUID(), deliveryId: input.deliveryId, driverId: input.driverId, assignedAt: new Date(), unassignedAt: null };
    this.assignments.push(assignment);
    return assignment;
  }

  async listByDelivery(_db: TenantDb, deliveryId: string): Promise<DeliveryAssignment[]> {
    return this.assignments.filter((a) => a.deliveryId === deliveryId);
  }
}
