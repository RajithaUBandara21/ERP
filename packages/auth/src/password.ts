import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id password hashing — see ADR-0006. Parameters follow OWASP's
 * current Argon2id baseline recommendation (m=19MiB, t=2, p=1); revisit only
 * with a measured reason (CLAUDE.md §56), not speculatively.
 */
const HASH_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, HASH_OPTIONS);
}

export async function verifyPassword(hashedPassword: string, plainPassword: string): Promise<boolean> {
  return verify(hashedPassword, plainPassword);
}
