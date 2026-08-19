import { hashSessionToken } from "../session-token";
import type { SessionRepository } from "./session-repository";

/** Idempotent — revoking an already-revoked or unknown token is not an error. */
export async function revokeSession(repository: SessionRepository, token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  const session = await repository.findByTokenHash(tokenHash);
  if (session) {
    await repository.revoke(session.id);
  }
}
