/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * pointing at a Postgres instance the test user can CREATE/DROP DATABASE on
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped when
 * either is absent.
 */
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getControlPlaneDb, schema } from "../src/control-plane/client";
import { provisionTenant } from "../src/tenant/provisioning";
import { eq } from "drizzle-orm";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("provisionTenant", () => {
  const slug = `prov-test-${Date.now()}`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("creates the tenant, its database, and registers the connection string", async () => {
    const result = await provisionTenant({ slug, name: "Provisioning Test Tenant" });
    expect(result.databaseName).toBe(databaseName);

    const db = getControlPlaneDb();
    const [registration] = await db
      .select()
      .from(schema.tenantDatabaseRegistry)
      .where(eq(schema.tenantDatabaseRegistry.tenantId, result.tenantId))
      .limit(1);
    expect(registration?.connectionString).toContain(databaseName);

    const tenantSql = postgres(registration!.connectionString, { max: 1 });
    const [ping] = await tenantSql`SELECT 1 as ok`;
    expect(ping?.ok).toBe(1);
    await tenantSql.end();
  });

  it("is idempotent — re-provisioning the same slug does not fail or duplicate", async () => {
    const first = await provisionTenant({ slug, name: "Provisioning Test Tenant" });
    const second = await provisionTenant({ slug, name: "Provisioning Test Tenant" });

    expect(second.tenantId).toBe(first.tenantId);
    expect(second.databaseName).toBe(first.databaseName);
  });
});
