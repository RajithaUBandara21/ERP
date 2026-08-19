import { hashPassword, verifyPassword } from "@erp/auth";
import type { TenantDb } from "@erp/database";
import { emailSchema } from "@erp/validation";
import { InvalidCredentialsError, UserNotActiveError, toPublicUser, type PublicUser } from "../domain/user";
import type { UserRepository } from "./user-repository";

// Computed once, lazily, and reused so a lookup for a non-existent email
// still pays the same Argon2 verify cost as a real one — mitigating
// account-enumeration via response timing (CLAUDE.md §57).
let dummyHash: string | undefined;
async function getDummyHash(): Promise<string> {
  dummyHash ??= await hashPassword("dummy-password-for-constant-time-comparison");
  return dummyHash;
}

export async function verifyCredentials(
  repository: UserRepository,
  db: TenantDb,
  input: { email: string; password: string },
): Promise<PublicUser> {
  const email = emailSchema.parse(input.email);
  const user = await repository.findByEmail(db, email);

  if (!user) {
    await verifyPassword(await getDummyHash(), input.password);
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await verifyPassword(user.passwordHash, input.password);
  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  if (user.status !== "active") {
    throw new UserNotActiveError();
  }

  return toPublicUser(user);
}
