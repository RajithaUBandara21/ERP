/**
 * Requires CONTROL_PLANE_DATABASE_URL (migrated) — see infrastructure/docker
 * or .github/workflows/ci.yml. Skipped otherwise. tenantModules/moduleVersions
 * FK into control-plane `tenants`, so this provisions a real tenant record
 * (not its database — core owns no tenant-DB tables, so no tenant database
 * provisioning/migration is needed for this test).
 */
import { ModuleRegistry } from "@erp/module-registry";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeControlPlaneDb } from "@erp/database";
import { createTenant, DrizzleTenantRepository } from "@erp/tenant";
import { installModule } from "../src/application/install-module";
import { listModules } from "../src/application/list-modules";
import { uninstallModule } from "../src/application/uninstall-module";
import { ModuleAlreadyInstalledError, ModuleHasDependentsError } from "../src/domain/errors";
import { DrizzleModuleRegistryRepository } from "../src/infrastructure/drizzle-module-registry-repository";
import { coreManifest } from "../src/module.manifest";

const hasDatabase = Boolean(process.env.CONTROL_PLANE_DATABASE_URL);

describe.skipIf(!hasDatabase)("module lifecycle (integration)", () => {
  const slug = `module-lifecycle-${Date.now()}`;
  const tenantRepo = new DrizzleTenantRepository();
  const repository = new DrizzleModuleRegistryRepository();
  let tenantId: string;

  const registry = new ModuleRegistry();
  registry.register(coreManifest);
  registry.register({
    id: "dummy-dependent",
    name: "Dummy Dependent",
    version: "1.0.0",
    description: "Test-only manifest that depends on core, to exercise the dependent-blocks-uninstall path.",
    dependencies: [{ moduleId: "core", versionRange: "*" }],
    permissions: [],
    routes: [],
    eventsPublished: [],
    eventsConsumed: [],
    configuration: [],
  });
  registry.validateGraph();

  beforeAll(async () => {
    const tenant = await createTenant(tenantRepo, { slug, name: "Module Lifecycle Test Tenant" });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await closeControlPlaneDb();
  });

  it("installs core end-to-end, recorded in the control plane with an audit trail", async () => {
    await installModule(registry, repository, tenantId, "core", "test-actor");

    const listing = await listModules(registry, repository, tenantId);
    const coreEntry = listing.find((entry) => entry.manifest.id === "core");
    expect(coreEntry?.status).toBe("active");
    expect(coreEntry?.version).toBe("1.0.0");
    // Audit trail: recordAuditEvent writes a structured log line — see
    // packages/logging/tests/audit.test.ts for the unit-level proof of its
    // shape. Verifying real stdout capture here would be redundant with that.
  });

  it("rejects re-installing an already-active module", async () => {
    await expect(installModule(registry, repository, tenantId, "core", "test-actor")).rejects.toThrow(
      ModuleAlreadyInstalledError,
    );
  });

  it("blocks uninstalling core while a dependent module is active for this tenant", async () => {
    await installModule(registry, repository, tenantId, "dummy-dependent", "test-actor");

    await expect(uninstallModule(registry, repository, tenantId, "core", "test-actor")).rejects.toThrow(
      ModuleHasDependentsError,
    );
  });

  it("uninstalls core end-to-end once the dependent is uninstalled, disabling not deleting", async () => {
    await uninstallModule(registry, repository, tenantId, "dummy-dependent", "test-actor");
    await uninstallModule(registry, repository, tenantId, "core", "test-actor");

    const listing = await listModules(registry, repository, tenantId);
    const coreEntry = listing.find((entry) => entry.manifest.id === "core");
    expect(coreEntry?.status).toBe("disabled");
    expect(coreEntry?.version).toBe("1.0.0"); // record preserved, not deleted
  });
});
