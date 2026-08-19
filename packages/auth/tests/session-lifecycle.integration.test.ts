/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated, including the sessions
 * table added in this phase) — see infrastructure/docker or
 * .github/workflows/ci.yml. Skipped otherwise.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getControlPlaneDb, schema } from "@erp/database";
import { createSession } from "../src/application/create-session";
import { revokeSession } from "../src/application/revoke-session";
import { validateSessionToken } from "../src/application/validate-session";
import { SessionInvalidError } from "../src/domain/session";
import { DrizzleSessionRepository } from "../src/infrastructure/drizzle-session-repository";

const hasDatabase = Boolean(process.env.CONTROL_PLANE_DATABASE_URL);

describe.skipIf(!hasDatabase)("session lifecycle (integration)", () => {
  const repo = new DrizzleSessionRepository();
  const runId = Date.now();
  const userId = randomUUID();
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const db = getControlPlaneDb();
    const [tenantA] = await db
      .insert(schema.tenants)
      .values({ slug: `session-test-a-${runId}`, name: "Session Test Tenant A" })
      .returning();
    const [tenantB] = await db
      .insert(schema.tenants)
      .values({ slug: `session-test-b-${runId}`, name: "Session Test Tenant B" })
      .returning();
    tenantAId = tenantA!.id;
    tenantBId = tenantB!.id;
  });

  afterAll(async () => {
    await closeControlPlaneDb();
  });

  it("creates a session and validates it against the correct tenant", async () => {
    const { token } = await createSession(repo, { tenantId: tenantAId, userId });
    const session = await validateSessionToken(repo, token, tenantAId);
    expect(session.userId).toBe(userId);
    expect(session.tenantId).toBe(tenantAId);
  });

  it("rejects a valid session token presented against a different tenant", async () => {
    const { token } = await createSession(repo, { tenantId: tenantAId, userId });
    await expect(validateSessionToken(repo, token, tenantBId)).rejects.toThrow(SessionInvalidError);
  });

  it("rejects an unknown token", async () => {
    await expect(validateSessionToken(repo, "not-a-real-token", tenantAId)).rejects.toThrow(SessionInvalidError);
  });

  it("rejects a revoked session", async () => {
    const { token } = await createSession(repo, { tenantId: tenantAId, userId });
    await revokeSession(repo, token);
    await expect(validateSessionToken(repo, token, tenantAId)).rejects.toThrow(SessionInvalidError);
  });

  it("revoking an unknown token is a no-op, not an error", async () => {
    await expect(revokeSession(repo, "never-issued-token")).resolves.not.toThrow();
  });
});
