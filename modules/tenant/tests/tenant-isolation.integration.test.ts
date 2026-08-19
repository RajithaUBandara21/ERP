/**
 * Mandatory tenant isolation test — CLAUDE.md §41 / TESTING.md §5: proves
 * Tenant A cannot access Tenant B's data, at the database connection level.
 *
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 */
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant } from "../src/application/create-tenant";
import { provisionTenantDatabase } from "../src/application/provision-tenant-database";
import { resolveTenantContext } from "../src/application/resolve-tenant-context";
import { TenantNotFoundError } from "../src/domain/tenant";
import { DrizzleTenantRepository } from "../src/infrastructure/drizzle-tenant-repository";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("tenant isolation (integration)", () => {
  const runId = Date.now();
  const slugA = `iso-a-${runId}`;
  const slugB = `iso-b-${runId}`;
  const dbNameA = `tenant_${slugA.replace(/-/g, "_")}`;
  const dbNameB = `tenant_${slugB.replace(/-/g, "_")}`;
  const repo = new DrizzleTenantRepository();

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${dbNameA}" WITH (FORCE)`);
    await admin.unsafe(`DROP DATABASE IF EXISTS "${dbNameB}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("gives each tenant its own physically distinct database", async () => {
    const tenantA = await createTenant(repo, { slug: slugA, name: "Isolation Tenant A" });
    const tenantB = await createTenant(repo, { slug: slugB, name: "Isolation Tenant B" });
    await provisionTenantDatabase(tenantA);
    await provisionTenantDatabase(tenantB);

    const dbA = await getTenantDb(tenantA.id);
    const dbB = await getTenantDb(tenantB.id);

    const [rowA] = (await dbA.execute(sql`SELECT current_database()`)) as unknown as [{ current_database: string }];
    const [rowB] = (await dbB.execute(sql`SELECT current_database()`)) as unknown as [{ current_database: string }];

    expect(rowA.current_database).toBe(dbNameA);
    expect(rowB.current_database).toBe(dbNameB);
    expect(rowA.current_database).not.toBe(rowB.current_database);
  });

  it("never leaks tenant B's data into a connection resolved for tenant A", async () => {
    const tenantA = await createTenant(repo, { slug: slugA, name: "Isolation Tenant A" });
    const tenantB = await createTenant(repo, { slug: slugB, name: "Isolation Tenant B" });

    const dbA = await getTenantDb(tenantA.id);
    const dbB = await getTenantDb(tenantB.id);

    // A marker written into tenant B's database, in a table that only exists there.
    await dbB.execute(sql`CREATE TABLE IF NOT EXISTS isolation_probe (marker text NOT NULL)`);
    await dbB.execute(sql`INSERT INTO isolation_probe (marker) VALUES ('tenant-b-secret')`);

    // Tenant A's connection is a genuinely separate Postgres database — the
    // table (and therefore the row) does not exist there at all. Drizzle
    // wraps the driver error, so the "does not exist" detail is on .cause.
    let caught: unknown;
    try {
      await dbA.execute(sql`SELECT * FROM isolation_probe`);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const cause = (caught as { cause?: { message?: string } }).cause;
    const message = cause?.message ?? (caught as Error).message;
    expect(message).toMatch(/does not exist/i);
  });

  it("resolving via each tenant's own host returns only that tenant's connection, never the other's", async () => {
    const tenantA = await createTenant(repo, { slug: slugA, name: "Isolation Tenant A" });
    const tenantB = await createTenant(repo, { slug: slugB, name: "Isolation Tenant B" });

    const contextA = await resolveTenantContext(repo, `${slugA}.platform.example.com`);
    const contextB = await resolveTenantContext(repo, `${slugB}.platform.example.com`);

    expect(contextA.tenant.id).toBe(tenantA.id);
    expect(contextB.tenant.id).toBe(tenantB.id);

    const [rowA] = (await contextA.tenantDb.execute(sql`SELECT current_database()`)) as unknown as [
      { current_database: string },
    ];
    const [rowB] = (await contextB.tenantDb.execute(sql`SELECT current_database()`)) as unknown as [
      { current_database: string },
    ];
    expect(rowA.current_database).not.toBe(rowB.current_database);
  });

  it("rejects an unregistered host rather than silently falling back to any tenant", async () => {
    await createTenant(repo, { slug: slugA, name: "Isolation Tenant A" });

    await expect(
      resolveTenantContext(repo, `definitely-not-registered-${runId}.platform.example.com`),
    ).rejects.toThrow(TenantNotFoundError);
  });

  it("repeated resolution of the same tenant reuses one connection, never drifting to another tenant's", async () => {
    const tenantA = await createTenant(repo, { slug: slugA, name: "Isolation Tenant A" });

    const first = await getTenantDb(tenantA.id);
    const second = await getTenantDb(tenantA.id);

    expect(first).toBe(second);
  });
});
