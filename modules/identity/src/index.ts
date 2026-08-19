export {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
  toPublicUser,
} from "./domain/user";
export type { PublicUser, User, UserStatus } from "./domain/user";

export { RoleNotFoundError, SYSTEM_ROLE_NAMES } from "./domain/role";
export type { Role } from "./domain/role";

export { IDENTITY_PERMISSIONS } from "./domain/permissions";
export type { IdentityPermission } from "./domain/permissions";

export type { UserRepository } from "./application/user-repository";
export { DrizzleUserRepository } from "./infrastructure/drizzle-user-repository";

export type { RoleRepository } from "./application/role-repository";
export { DrizzleRoleRepository } from "./infrastructure/drizzle-role-repository";

export { registerUser } from "./application/register-user";
export type { RegisterUserInput } from "./application/register-user";

export { verifyCredentials } from "./application/verify-credentials";

export { seedDefaultRoles } from "./application/seed-default-roles";
export type { DefaultRoles } from "./application/seed-default-roles";

export { getUserPermissions } from "./application/get-user-permissions";

export { applyIdentityMigrations } from "./apply-migrations";

export { identityManifest } from "./module.manifest";
