/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 * Provisions a real tenant, installs inventory through the module registry
 * (proving applyInventoryMigrations really creates the tables), and proves
 * the row-locking in DrizzleStockRepository.applyMovement actually
 * prevents overselling under genuine concurrent connections — the fake
 * in-memory repository in tests/fakes.ts can't exercise this, since it has
 * no real transaction/locking semantics to get wrong.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase, tenantManifest } from "@erp/tenant";
import { identityManifest } from "@erp/identity";
import { coreManifest, DrizzleModuleRegistryRepository, installModule } from "@erp/core";
import { ModuleRegistry } from "@erp/module-registry";
import { InsufficientStockError } from "../src/domain/errors";
import { confirmSale } from "../src/application/confirm-sale";
import { receiveStock } from "../src/application/receive-stock";
import { reserveStock } from "../src/application/reserve-stock";
import { DrizzleStockRepository } from "../src/infrastructure/drizzle-stock-repository";
import { DrizzleWarehouseRepository } from "../src/infrastructure/drizzle-warehouse-repository";
import { inventoryManifest } from "../src/module.manifest";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("inventory lifecycle (integration)", () => {
  const slug = `inventory-test-${Date.now()}`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  let tenantId: string;

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Inventory Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);

    const registry = new ModuleRegistry();
    registry.register(coreManifest);
    registry.register(tenantManifest);
    registry.register(identityManifest);
    registry.register(inventoryManifest);
    registry.validateGraph();

    const moduleRepo = new DrizzleModuleRegistryRepository();
    await installModule(registry, moduleRepo, tenantId, "core", null);
    await installModule(registry, moduleRepo, tenantId, "tenant", null);
    await installModule(registry, moduleRepo, tenantId, "identity", null);
    await installModule(registry, moduleRepo, tenantId, "inventory", null); // proves applyInventoryMigrations really runs
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("receives, reserves, and confirms a sale against real tables", async () => {
    const db = await getTenantDb(tenantId);
    const deps = { stockRepository: new DrizzleStockRepository(), warehouseRepository: new DrizzleWarehouseRepository() };

    await receiveStock(deps, db, { sku: "SKU-REAL-1", quantity: 20 });
    await reserveStock(deps, db, { lines: [{ sku: "SKU-REAL-1", quantity: 5 }] });
    await confirmSale(deps, db, { lines: [{ sku: "SKU-REAL-1", quantity: 5 }] });

    const warehouse = await deps.warehouseRepository.findDefault(db);
    const level = await deps.stockRepository.getLevel(db, warehouse!.id, "SKU-REAL-1");
    expect(level).toMatchObject({ onHand: 15, reserved: 0, available: 15 });
  });

  it("prevents overselling under real concurrent reservations for the last unit", async () => {
    const db = await getTenantDb(tenantId);
    const deps = { stockRepository: new DrizzleStockRepository(), warehouseRepository: new DrizzleWarehouseRepository() };

    await receiveStock(deps, db, { sku: "SKU-REAL-2", quantity: 1 });

    const results = await Promise.allSettled([
      reserveStock(deps, db, { lines: [{ sku: "SKU-REAL-2", quantity: 1 }] }),
      reserveStock(deps, db, { lines: [{ sku: "SKU-REAL-2", quantity: 1 }] }),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);

    const warehouse = await deps.warehouseRepository.findDefault(db);
    const level = await deps.stockRepository.getLevel(db, warehouse!.id, "SKU-REAL-2");
    // Exactly one unit reserved — never both, never zero.
    expect(level).toMatchObject({ onHand: 1, reserved: 1, available: 0 });
  });
});
