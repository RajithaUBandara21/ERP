/**
 * Requires a real reachable Postgres (CONTROL_PLANE_DATABASE_URL) with the
 * control-plane migrations already applied — see infrastructure/docker or
 * .github/workflows/ci.yml. Skipped automatically when that's not present
 * (e.g. a plain `pnpm test` outside docker compose / CI).
 */
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getControlPlaneDb, schema } from "../src/control-plane/client";

const hasDatabase = Boolean(process.env.CONTROL_PLANE_DATABASE_URL);

describe.skipIf(!hasDatabase)("control-plane database", () => {
  afterAll(async () => {
    await closeControlPlaneDb();
  });

  it("connects and can query the tenants table", async () => {
    const db = getControlPlaneDb();
    const rows = await db.select().from(schema.tenants).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("round-trips a tenant insert and read", async () => {
    const db = getControlPlaneDb();
    const slug = `test-${Date.now()}`;

    const [created] = await db.insert(schema.tenants).values({ slug, name: "Integration Test Tenant" }).returning();
    expect(created?.slug).toBe(slug);

    const [found] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, slug)).limit(1);
    expect(found?.id).toBe(created?.id);
  });
});
