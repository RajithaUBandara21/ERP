/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) and TENANT_DATABASE_ADMIN_URL
 * — see infrastructure/docker or .github/workflows/ci.yml. Skipped otherwise.
 *
 * Phase 7: proves the identity/tenant manifest retrofit actually works —
 * installing "identity" through the registry (not by calling
 * applyIdentityMigrations directly, as earlier phases' tests do) really
 * creates the users/roles tables, and the dependency graph is enforced for
 * more than one real module (installing identity before core is rejected).
 */
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb, getTenantDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository, provisionTenantDatabase, tenantManifest } from "@erp/tenant";
import {
  DrizzleRoleRepository,
  DrizzleUserRepository,
  identityManifest,
  registerUser,
  seedDefaultRoles,
  verifyCredentials,
} from "@erp/identity";
import {
  coreManifest,
  DependencyNotInstalledError,
  DrizzleModuleRegistryRepository,
  installModule,
  listModules,
} from "@erp/core";
import { ModuleRegistry } from "@erp/module-registry";

const hasDatabases = Boolean(process.env.CONTROL_PLANE_DATABASE_URL && process.env.TENANT_DATABASE_ADMIN_URL);

describe.skipIf(!hasDatabases)("module installation retrofit (integration)", () => {
  const slug = `retrofit-${Date.now()}`;
  const databaseName = `tenant_${slug.replace(/-/g, "_")}`;
  const tenantRepo = new DrizzleTenantRepository();
  const moduleRepo = new DrizzleModuleRegistryRepository();
  let tenantId: string;

  const registry = new ModuleRegistry();
  registry.register(coreManifest);
  registry.register(tenantManifest);
  registry.register(identityManifest);
  registry.validateGraph();

  afterAll(async () => {
    const admin = postgres(process.env.TENANT_DATABASE_ADMIN_URL!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await closeControlPlaneDb();
  });

  it("rejects installing identity before its dependency (core) is installed", async () => {
    const tenant = await createTenant(tenantRepo, { slug, name: "Retrofit Test Tenant" });
    tenantId = tenant.id;
    await provisionTenantDatabase(tenant);

    await expect(installModule(registry, moduleRepo, tenantId, "identity", null)).rejects.toThrow(
      DependencyNotInstalledError,
    );
  });

  it("installing identity through the registry actually creates the users/roles tables and login works", async () => {
    await installModule(registry, moduleRepo, tenantId, "core", null);
    await installModule(registry, moduleRepo, tenantId, "tenant", null);
    await installModule(registry, moduleRepo, tenantId, "identity", null); // this is the real proof: migrations run via the manifest hook, not a direct call

    const db = await getTenantDb(tenantId);
    const { owner } = await seedDefaultRoles(new DrizzleRoleRepository(), db);
    const userRepository = new DrizzleUserRepository();
    await registerUser(userRepository, db, { email: "owner@retrofit.test", password: "supersecret1", name: "Owner", roleId: owner.id });

    const verified = await verifyCredentials(userRepository, db, { email: "owner@retrofit.test", password: "supersecret1" });
    expect(verified.email).toBe("owner@retrofit.test");
  });

  it("all three modules show active in the tenant's module listing", async () => {
    const listing = await listModules(registry, moduleRepo, tenantId);
    const statusById = Object.fromEntries(listing.map((entry) => [entry.manifest.id, entry.status]));

    expect(statusById["core"]).toBe("active");
    expect(statusById["tenant"]).toBe("active");
    expect(statusById["identity"]).toBe("active");
  });
});
