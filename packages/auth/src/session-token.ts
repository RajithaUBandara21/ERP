import { createHash } from "node:crypto";
import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";

/**
 * Opaque session tokens (not JWTs) — see ADR-0006. The raw token is what
 * the client holds (in an httpOnly cookie); only its SHA-256 hash is ever
 * persisted, so a database read (e.g. a backup, a compromised replica)
 * cannot be turned directly into a usable session credential.
 *
 * SHA-256 hashing uses Node's built-in `crypto`, not `@oslojs/crypto` as
 * ADR-0006 originally specified — `@oslojs/crypto` was found to be fully
 * deprecated ("no longer supported") on npm during Phase 4 implementation,
 * which contradicts ADR-0006's "audited, maintained primitives" rationale.
 * `@oslojs/encoding` (used below for base32) is unaffected and still
 * maintained. See ADR-0006's Update section.
 */

const TOKEN_BYTE_LENGTH = 20; // 160 bits of entropy

export function generateSessionToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
