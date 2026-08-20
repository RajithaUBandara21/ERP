import type { TenantDb } from "@erp/database";
import { eq } from "drizzle-orm";
import type { Driver, DriverStatus } from "../domain/driver";
import type { DriverRepository } from "../application/driver-repository";
import { drivers } from "./persistence/schema";

function toDomain(row: typeof drivers.$inferSelect): Driver {
  return { id: row.id, name: row.name, status: row.status as DriverStatus, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export class DrizzleDriverRepository implements DriverRepository {
  async create(db: TenantDb, input: { name: string }): Promise<Driver> {
    const [row] = await db.insert(drivers).values(input).returning();
    if (!row) throw new Error("Failed to create driver");
    return toDomain(row);
  }

  async findById(db: TenantDb, id: string): Promise<Driver | undefined> {
    const [row] = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
    return row ? toDomain(row) : undefined;
  }

  async list(db: TenantDb): Promise<Driver[]> {
    const rows = await db.select().from(drivers);
    return rows.map(toDomain);
  }
}
