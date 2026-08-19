/**
 * The ModuleManifest contract — see MODULE-SYSTEM.md §2. `routes`,
 * `eventsPublished`/`eventsConsumed`, and `configuration` are declared here
 * for shape-completeness but not yet consumed by anything (no nav/UI system
 * and no event bus exist yet — Phase 13 wires events; a future UI phase
 * wires routes/nav). This remains a deliberate scope decision as of Phase 7
 * — see docs/modules/core.md. `applyMigrations` (below) is the one lifecycle
 * hook that Phase 7 does wire up, since tenant-DB migrations already exist
 * (modules/identity) and needed a generic install-time hook.
 */

export interface ModuleDependency {
  moduleId: string;
  /** "*" (any version) or an exact version string — see version.ts's doc comment for why full semver ranges aren't supported yet. */
  versionRange: string;
}

export interface PermissionDefinition {
  key: string;
  description: string;
}

export interface RouteDefinition {
  path: string;
  description?: string;
}

export interface EventDefinition {
  type: string;
  description?: string;
}

export interface ConfigurationDefinition {
  key: string;
  description: string;
  defaultValue?: unknown;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  dependencies: ModuleDependency[];
  permissions: PermissionDefinition[];
  routes: RouteDefinition[];
  eventsPublished: EventDefinition[];
  eventsConsumed: EventDefinition[];
  configuration: ConfigurationDefinition[];
  /**
   * Applies this module's tenant-DB schema to one tenant, if it owns any
   * (omitted for modules with none, e.g. core/tenant as of Phase 7 — see
   * modules/identity/src/module.manifest.ts for a module that does). Called
   * by modules/core's installModule as step 3 of MODULE-SYSTEM.md §3 — this
   * is what "generalizes" the migration-application stand-in Phase 4/6
   * documented (see DATABASE.md §6), without @erp/module-registry (a pure,
   * module-agnostic package) needing to import any specific module.
   */
  applyMigrations?: (tenantId: string) => Promise<void>;
}
