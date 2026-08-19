/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 */
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb } from "@erp/database";
import { createTenant } from "../src/application/create-tenant";
import { getTenantBySlug } from "../src/application/get-tenant-by-slug";
import { provisionTenantDatabase } from "../src/application/provision-tenant-database";
import { resolveTenantContext } from "../src/application/resolve-tenant-context";
import { DrizzleTenantRepository } from "../src/infrastructure/drizzle-tenant-repository";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("tenant lifecycle (integration)", () => {
  const slug = `lifecycle-${Date.now()}`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const repo = new DrizzleTenantRepository();

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("creates, provisions, and resolves a tenant end-to-end", async () => {
    const created = await createTenant(repo, { slug, name: "Lifecycle Test Tenant" });
    expect(created.status).toBe("active");

    await provisionTenantDatabase(created);

    const found = await getTenantBySlug(repo, slug);
    expect(found.id).toBe(created.id);

    const context = await resolveTenantContext(repo, `${slug}.platform.example.com`);
    expect(context.tenant.id).toBe(created.id);

    const [{ current_database: currentDatabase }] = (await context.tenantDb.execute(
      sql`SELECT current_database()`,
    )) as unknown as [{ current_database: string }];
    expect(currentDatabase).toBe(databaseName);
  });

  it("is idempotent — provisioning the same tenant twice does not fail", async () => {
    const tenant = await getTenantBySlug(repo, slug);
    await expect(provisionTenantDatabase(tenant)).resolves.not.toThrow();
  });
});
