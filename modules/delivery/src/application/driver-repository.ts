import type { TenantDb } from "@erp/database";
import type { Driver } from "../domain/driver";

export interface DriverRepository {
  create(db: TenantDb, input: { name: string }): Promise<Driver>;
  findById(db: TenantDb, id: string): Promise<Driver | undefined>;
  list(db: TenantDb): Promise<Driver[]>;
}
