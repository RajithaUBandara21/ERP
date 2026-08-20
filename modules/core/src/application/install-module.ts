import { recordAuditEvent } from "@erp/logging";
import { satisfiesVersionRange, type ModuleRegistry } from "@erp/module-registry";
import {
  DependencyNotInstalledError,
  IncompatibleDependencyVersionError,
  ModuleAlreadyInstalledError,
  ModuleNotEntitledError,
} from "../domain/errors";
import { AllowAllEntitlementChecker } from "../infrastructure/allow-all-entitlement-checker";
import type { EntitlementChecker } from "./entitlement-checker";
import type { ModuleRegistryRepository } from "./module-registry-repository";

/**
 * The 10-step installation sequence from MODULE-SYSTEM.md §3, applied to
 * one tenant. Steps 4–7 (register permissions/routes/configuration/event
 * handlers) are explicitly no-ops right now — there is no per-tenant
 * permission-catalog table, route/nav system, or event bus yet to register
 * *into* (see the doc comments on modules/core's manifest and
 * @erp/module-registry's types.ts). They are left as visible steps in this
 * function, not silently skipped, so the sequence stays honest about what
 * this codebase does and doesn't do yet. Step 3 (migrations) IS wired, as
 * of Phase 7 — see ModuleManifest.applyMigrations's doc comment.
 *
 * entitlementChecker defaults to AllowAllEntitlementChecker so every
 * existing caller (scripts, tests, other modules) keeps working unchanged;
 * only apps/web's real install route wires modules/billing's
 * SubscriptionEntitlementChecker (Phase 15 — CLAUDE.md §48).
 */
export async function installModule(
  registry: ModuleRegistry,
  repository: ModuleRegistryRepository,
  tenantId: string,
  moduleId: string,
  actor: string | null,
  entitlementChecker: EntitlementChecker = new AllowAllEntitlementChecker(),
): Promise<void> {
  const manifest = registry.get(moduleId); // throws ModuleNotRegisteredError if unknown to the registry

  const existing = await repository.findInstalled(tenantId, moduleId);
  if (existing?.status === "active") {
    throw new ModuleAlreadyInstalledError(moduleId);
  }

  if (!(await entitlementChecker.isModuleIncluded(tenantId, moduleId))) {
    throw new ModuleNotEntitledError(moduleId, tenantId);
  }

  // 1-2. Validate dependencies + compatibility, against THIS TENANT's installed state.
  for (const dependency of manifest.dependencies) {
    const installedDependency = await repository.findInstalled(tenantId, dependency.moduleId);
    if (!installedDependency || installedDependency.status !== "active") {
      throw new DependencyNotInstalledError(moduleId, dependency.moduleId);
    }
    if (!satisfiesVersionRange(installedDependency.version, dependency.versionRange)) {
      throw new IncompatibleDependencyVersionError(
        moduleId,
        dependency.moduleId,
        installedDependency.version,
        dependency.versionRange,
      );
    }
  }

  // 3. Run migrations — this module's own tenant-DB schema, if it has one
  // (e.g. modules/identity's users/roles tables). A module with no
  // tenant-DB schema (core, tenant) simply omits applyMigrations.
  await manifest.applyMigrations?.(tenantId);

  // 4. Register permissions — no-op: no per-tenant permission-catalog table exists yet.
  // 5. Register routes — no-op: no route/nav registry exists yet.
  // 6. Register configuration — no-op: no per-tenant configuration store exists yet.
  // 7. Register event handlers — no-op: no event bus exists yet (Phase 13).

  // 8-9. Activate + record version.
  await repository.recordInstallation(tenantId, moduleId, manifest.version);

  // 10. Audit.
  recordAuditEvent({
    module: "core",
    actor,
    tenantId,
    action: "module.install",
    resource: "module",
    resourceId: moduleId,
  });
}
