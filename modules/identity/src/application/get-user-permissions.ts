import type { TenantDb } from "@erp/database";
import { RoleNotFoundError } from "../domain/role";
import { UserNotActiveError, UserNotFoundError } from "../domain/user";
import type { RoleRepository } from "./role-repository";
import type { UserRepository } from "./user-repository";

/**
 * Loads the permission set for an already-authenticated user — the last
 * link in session → tenant → role → permission (MULTI-TENANCY.md §2,
 * ADR-0007). Throws rather than returning an empty list on a data
 * inconsistency (missing/inactive user or role), so a caller can't
 * mistake "couldn't determine permissions" for "legitimately has none."
 */
export async function getUserPermissions(
  userRepository: UserRepository,
  roleRepository: RoleRepository,
  db: TenantDb,
  userId: string,
): Promise<string[]> {
  const user = await userRepository.findById(db, userId);
  if (!user) throw new UserNotFoundError(userId);
  if (user.status !== "active") throw new UserNotActiveError();

  const role = await roleRepository.findById(db, user.roleId);
  if (!role) throw new RoleNotFoundError(user.roleId);

  return role.permissions;
}
