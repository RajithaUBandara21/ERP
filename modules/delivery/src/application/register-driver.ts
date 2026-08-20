import type { TenantDb } from "@erp/database";
import type { Driver } from "../domain/driver";
import type { DriverRepository } from "./driver-repository";

export interface RegisterDriverInput {
  name: string;
}

export async function registerDriver(repository: DriverRepository, db: TenantDb, input: RegisterDriverInput): Promise<Driver> {
  return repository.create(db, input);
}
