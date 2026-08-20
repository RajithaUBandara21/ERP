/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 * Provisions a real tenant, installs reporting through the module registry
 * (proving applyReportingMigrations really creates the table), and proves
 * incrementForDate's atomicity under genuine concurrent connections — the
 * fake in-memory repository in tests/fakes.ts can't exercise this, since
 * it has no real transaction/locking semantics to get wrong.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase, tenantManifest } from "@erp/tenant";
import { identityManifest } from "@erp/identity";
import { coreManifest, DrizzleModuleRegistryRepository, installModule } from "@erp/core";
import { ModuleRegistry } from "@erp/module-registry";
import { getSalesSummary } from "../src/application/get-sales-summary";
import { DrizzleSalesSummaryRepository } from "../src/infrastructure/drizzle-sales-summary-repository";
import { reportingManifest } from "../src/module.manifest";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("sales summary lifecycle (integration)", () => {
  const slug = `reporting-test-${Date.now()}`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  let tenantId: string;

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Reporting Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);

    const registry = new ModuleRegistry();
    registry.register(coreManifest);
    registry.register(tenantManifest);
    registry.register(identityManifest);
    registry.register(reportingManifest);
    registry.validateGraph();

    const moduleRepo = new DrizzleModuleRegistryRepository();
    await installModule(registry, moduleRepo, tenantId, "core", null);
    await installModule(registry, moduleRepo, tenantId, "tenant", null);
    await installModule(registry, moduleRepo, tenantId, "identity", null);
    await installModule(registry, moduleRepo, tenantId, "reporting", null); // proves applyReportingMigrations really runs
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("increments and paginates against real tables", async () => {
    const db = await getTenantDb(tenantId);
    const repository = new DrizzleSalesSummaryRepository();

    await repository.incrementForDate(db, "2026-08-19", 1, 1000);
    await repository.incrementForDate(db, "2026-08-19", 1, 500);

    const page = await getSalesSummary(repository, db, { limit: 10 });
    expect(page.items).toEqual([expect.objectContaining({ date: "2026-08-19", transactionCount: 2, totalCents: 1500 })]);
  });

  it("prevents a lost update under real concurrent increments to the same date", async () => {
    const db = await getTenantDb(tenantId);
    const repository = new DrizzleSalesSummaryRepository();
    const date = "2026-08-20";

    // 20 concurrent +1/+100 increments — a read-then-write implementation
    // would lose some of these under real concurrency; an atomic
    // INSERT ... ON CONFLICT DO UPDATE must not.
    await Promise.all(Array.from({ length: 20 }, () => repository.incrementForDate(db, date, 1, 100)));

    const page = await getSalesSummary(repository, db, { limit: 10 });
    const row = page.items.find((item) => item.date === date);
    expect(row).toMatchObject({ transactionCount: 20, totalCents: 2000 });
  });
});
