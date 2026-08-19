import { hashPassword } from "@erp/auth";
import type { TenantDb } from "@erp/database";
import { emailSchema } from "@erp/validation";
import { EmailAlreadyRegisteredError, toPublicUser, type PublicUser } from "../domain/user";
import type { UserRepository } from "./user-repository";

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  /** Explicit, not defaulted — the caller decides which seeded/custom role a new user gets (see seed-default-roles.ts). */
  roleId: string;
}

export async function registerUser(
  repository: UserRepository,
  db: TenantDb,
  input: RegisterUserInput,
): Promise<PublicUser> {
  const email = emailSchema.parse(input.email);
  const name = input.name.trim();
  if (!name) throw new Error("User name must not be empty");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");

  const existing = await repository.findByEmail(db, email);
  if (existing) throw new EmailAlreadyRegisteredError(email);

  const passwordHash = await hashPassword(input.password);
  const user = await repository.create(db, { email, passwordHash, name, roleId: input.roleId });
  return toPublicUser(user);
}
