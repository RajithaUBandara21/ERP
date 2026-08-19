import type { TenantDb } from "@erp/database";
import type { Role } from "../domain/role";

export interface RoleRepository {
  findById(db: TenantDb, id: string): Promise<Role | undefined>;
  findByName(db: TenantDb, name: string): Promise<Role | undefined>;
  /** Idempotent: returns the existing role if one with this name already exists. */
  create(db: TenantDb, input: { name: string; permissions: string[]; isSystemRole: boolean }): Promise<Role>;
}
