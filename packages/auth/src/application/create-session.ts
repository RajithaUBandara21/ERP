import { generateSessionToken, hashSessionToken } from "../session-token";
import type { SessionRepository } from "./session-repository";

/** Web session lifetime — revisit with a measured reason, not speculatively (CLAUDE.md §56). */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CreateSessionResult {
  token: string;
  expiresAt: Date;
}

/**
 * Always creates a fresh session — never extends/reuses an existing one.
 * This is what satisfies "session ID regenerated on login" (SECURITY.md §3,
 * session fixation) without any extra bookkeeping: login never has a prior
 * session to reuse in the first place.
 */
export async function createSession(
  repository: SessionRepository,
  input: { tenantId: string; userId: string },
): Promise<CreateSessionResult> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await repository.create({ tenantId: input.tenantId, userId: input.userId, tokenHash, expiresAt });

  return { token, expiresAt };
}
