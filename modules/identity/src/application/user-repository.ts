import type { TenantDb } from "@erp/database";
import type { User } from "../domain/user";

/**
 * Every method takes the caller's already-resolved TenantDb explicitly —
 * this repository has no ambient "current tenant" state of its own,
 * matching MULTI-TENANCY.md §2: whichever tenant's connection the caller
 * resolved is the only one this repository can ever read/write.
 */
export interface UserRepository {
  findByEmail(db: TenantDb, email: string): Promise<User | undefined>;
  findById(db: TenantDb, id: string): Promise<User | undefined>;
  create(db: TenantDb, input: { email: string; passwordHash: string; name: string; roleId: string }): Promise<User>;
  listAll(db: TenantDb): Promise<User[]>;
}
