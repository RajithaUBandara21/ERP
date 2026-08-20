export { coreManifest } from "./module.manifest";
export { applyCoreMigrations } from "./apply-migrations";
export { CORE_PERMISSIONS } from "./domain/permissions";
export type { CorePermission } from "./domain/permissions";

export {
  DependencyNotInstalledError,
  IncompatibleDependencyVersionError,
  ModuleAlreadyInstalledError,
  ModuleHasDependentsError,
  ModuleNotEntitledError,
  ModuleNotInstalledError,
} from "./domain/errors";

export type { ModuleInstallationRecord, ModuleRegistryRepository } from "./application/module-registry-repository";
export { DrizzleModuleRegistryRepository } from "./infrastructure/drizzle-module-registry-repository";

export type { EntitlementChecker } from "./application/entitlement-checker";
export { AllowAllEntitlementChecker } from "./infrastructure/allow-all-entitlement-checker";

export { installModule } from "./application/install-module";
export { uninstallModule } from "./application/uninstall-module";
export { listModules } from "./application/list-modules";
export type { ModuleListing } from "./application/list-modules";
