import { hashSessionToken } from "../session-token";
import { SessionInvalidError, type Session } from "../domain/session";
import type { SessionRepository } from "./session-repository";

/**
 * Validates a session token AND that it belongs to the tenant the request
 * was resolved for — this is the session/tenant cross-check MULTI-TENANCY.md
 * §2 requires from Phase 4 onward. All failure modes (not found, expired,
 * revoked, tenant mismatch) throw the same SessionInvalidError with no
 * detail distinguishing them, so a caller cannot use response differences
 * to probe for valid-token-wrong-tenant vs invalid-token.
 */
export async function validateSessionToken(
  repository: SessionRepository,
  token: string,
  expectedTenantId: string,
): Promise<Session> {
  const tokenHash = hashSessionToken(token);
  const session = await repository.findByTokenHash(tokenHash);

  if (!session) throw new SessionInvalidError("not_found");
  if (session.revokedAt) throw new SessionInvalidError("revoked");
  if (session.expiresAt.getTime() <= Date.now()) throw new SessionInvalidError("expired");
  if (session.tenantId !== expectedTenantId) throw new SessionInvalidError("not_found");

  await repository.touch(session.id, new Date());
  return session;
}
