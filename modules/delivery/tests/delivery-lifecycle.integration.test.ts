/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 * Provisions a real tenant, installs delivery through the module registry
 * (proving applyDeliveryMigrations really creates the tables), and
 * exercises the full driver → delivery → assign → complete flow, plus a
 * fail → reassign retry, against real Postgres.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase, tenantManifest } from "@erp/tenant";
import { identityManifest } from "@erp/identity";
import { coreManifest, DrizzleModuleRegistryRepository, installModule } from "@erp/core";
import { ModuleRegistry } from "@erp/module-registry";
import { assignDriver } from "../src/application/assign-driver";
import { completeDelivery } from "../src/application/complete-delivery";
import { createDelivery } from "../src/application/create-delivery";
import { failDelivery } from "../src/application/fail-delivery";
import { registerDriver } from "../src/application/register-driver";
import { DrizzleDeliveryAssignmentRepository } from "../src/infrastructure/drizzle-delivery-assignment-repository";
import { DrizzleDeliveryRepository } from "../src/infrastructure/drizzle-delivery-repository";
import { DrizzleDriverRepository } from "../src/infrastructure/drizzle-driver-repository";
import { deliveryManifest } from "../src/module.manifest";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("delivery lifecycle (integration)", () => {
  const slug = `delivery-test-${Date.now()}`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  let tenantId: string;

  beforeAll(async () => {
    const tenantRepo = new DrizzleTenantRepository();
    const tenant = await createTenant(tenantRepo, { slug, name: "Delivery Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);

    const registry = new ModuleRegistry();
    registry.register(coreManifest);
    registry.register(tenantManifest);
    registry.register(identityManifest);
    registry.register(deliveryManifest);
    registry.validateGraph();

    const moduleRepo = new DrizzleModuleRegistryRepository();
    await installModule(registry, moduleRepo, tenantId, "core", null);
    await installModule(registry, moduleRepo, tenantId, "tenant", null);
    await installModule(registry, moduleRepo, tenantId, "identity", null);
    await installModule(registry, moduleRepo, tenantId, "delivery", null); // proves applyDeliveryMigrations really runs
  });

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("runs the full driver -> delivery -> assign -> complete flow against real tables", async () => {
    const db = await getTenantDb(tenantId);
    const driverRepository = new DrizzleDriverRepository();
    const deliveryRepository = new DrizzleDeliveryRepository();
    const assignmentRepository = new DrizzleDeliveryAssignmentRepository();
    const deps = { deliveryRepository, driverRepository, assignmentRepository };

    const driver = await registerDriver(driverRepository, db, { name: "Real Driver" });
    const delivery = await createDelivery(deliveryRepository, db, { orderReference: "pos-transaction-123" });
    expect(delivery.status).toBe("pending");

    const assigned = await assignDriver(deps, db, { deliveryId: delivery.id, driverId: driver.id });
    expect(assigned.status).toBe("assigned");

    const completed = await completeDelivery(deliveryRepository, db, delivery.id);
    expect(completed.status).toBe("completed");
  });

  it("supports a fail -> reassign retry against real tables", async () => {
    const db = await getTenantDb(tenantId);
    const driverRepository = new DrizzleDriverRepository();
    const deliveryRepository = new DrizzleDeliveryRepository();
    const assignmentRepository = new DrizzleDeliveryAssignmentRepository();
    const deps = { deliveryRepository, driverRepository, assignmentRepository };

    const firstDriver = await registerDriver(driverRepository, db, { name: "First Driver" });
    const secondDriver = await registerDriver(driverRepository, db, { name: "Second Driver" });
    const delivery = await createDelivery(deliveryRepository, db, { orderReference: "pos-transaction-456" });

    await assignDriver(deps, db, { deliveryId: delivery.id, driverId: firstDriver.id });
    const failed = await failDelivery(deliveryRepository, db, delivery.id);
    expect(failed.status).toBe("failed");

    const reassigned = await assignDriver(deps, db, { deliveryId: delivery.id, driverId: secondDriver.id });
    expect(reassigned.status).toBe("assigned");
    expect(reassigned.driverId).toBe(secondDriver.id);

    const history = await assignmentRepository.listByDelivery(db, delivery.id);
    expect(history).toHaveLength(2);
  });
});
