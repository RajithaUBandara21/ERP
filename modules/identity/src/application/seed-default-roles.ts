import { WILDCARD_PERMISSION } from "@erp/authorization";
import type { TenantDb } from "@erp/database";
import { SYSTEM_ROLE_NAMES, type Role } from "../domain/role";
import type { RoleRepository } from "./role-repository";

export interface DefaultRoles {
  owner: Role;
  member: Role;
}

/**
 * Idempotent — safe to call on every tenant bootstrap. Owner gets every
 * permission (the wildcard); Member gets none (default-deny) until real
 * per-module roles are assigned as business modules land and register
 * their own permissions (Phase 6+).
 */
export async function seedDefaultRoles(repository: RoleRepository, db: TenantDb): Promise<DefaultRoles> {
  const owner = await repository.create(db, {
    name: SYSTEM_ROLE_NAMES.OWNER,
    permissions: [WILDCARD_PERMISSION],
    isSystemRole: true,
  });
  const member = await repository.create(db, {
    name: SYSTEM_ROLE_NAMES.MEMBER,
    permissions: [],
    isSystemRole: true,
  });

  return { owner, member };
}
