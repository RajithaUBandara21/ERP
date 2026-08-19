export interface ModuleInstallationRecord {
  moduleId: string;
  status: "active" | "disabled";
  version: string;
  installedAt: Date | null;
}

/** Backed by the control-plane's tenant_modules/module_versions tables (DATABASE.md §2) — not a tenant-DB repository, unlike most of this codebase's other repositories. */
export interface ModuleRegistryRepository {
  findInstalled(tenantId: string, moduleId: string): Promise<ModuleInstallationRecord | undefined>;
  listInstalled(tenantId: string): Promise<ModuleInstallationRecord[]>;
  /** Upserts: creates the record active, or re-activates/updates the version of an existing (e.g. previously disabled) one. */
  recordInstallation(tenantId: string, moduleId: string, version: string): Promise<void>;
  /** Sets status to 'disabled'. Never deletes the record — see MODULE-SYSTEM.md §6. */
  disable(tenantId: string, moduleId: string): Promise<void>;
}
