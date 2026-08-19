import { getControlPlaneDb, schema } from "@erp/database";
import { eq } from "drizzle-orm";
import type { Session } from "../domain/session";
import type { SessionRepository } from "../application/session-repository";

function toDomainSession(row: typeof schema.sessions.$inferSelect): Session {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

export class DrizzleSessionRepository implements SessionRepository {
  async create(input: { tenantId: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<Session> {
    const db = getControlPlaneDb();
    const [row] = await db.insert(schema.sessions).values(input).returning();
    if (!row) {
      throw new Error("Failed to create session");
    }
    return toDomainSession(row);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | undefined> {
    const db = getControlPlaneDb();
    const [row] = await db.select().from(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash)).limit(1);
    return row ? toDomainSession(row) : undefined;
  }

  async touch(id: string, lastUsedAt: Date): Promise<void> {
    const db = getControlPlaneDb();
    await db.update(schema.sessions).set({ lastUsedAt, updatedAt: new Date() }).where(eq(schema.sessions.id, id));
  }

  async revoke(id: string): Promise<void> {
    const db = getControlPlaneDb();
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.sessions.id, id));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const db = getControlPlaneDb();
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.sessions.userId, userId));
  }
}
