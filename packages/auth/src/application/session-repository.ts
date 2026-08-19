import type { Session } from "../domain/session";

export interface SessionRepository {
  create(input: { tenantId: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | undefined>;
  touch(id: string, lastUsedAt: Date): Promise<void>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
