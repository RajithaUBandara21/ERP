import type { ModuleInstallationRecord, ModuleRegistryRepository } from "../src/application/module-registry-repository";

export class FakeModuleRegistryRepository implements ModuleRegistryRepository {
  private readonly byTenant = new Map<string, Map<string, ModuleInstallationRecord>>();

  private forTenant(tenantId: string): Map<string, ModuleInstallationRecord> {
    let records = this.byTenant.get(tenantId);
    if (!records) {
      records = new Map();
      this.byTenant.set(tenantId, records);
    }
    return records;
  }

  async findInstalled(tenantId: string, moduleId: string): Promise<ModuleInstallationRecord | undefined> {
    return this.forTenant(tenantId).get(moduleId);
  }

  async listInstalled(tenantId: string): Promise<ModuleInstallationRecord[]> {
    return [...this.forTenant(tenantId).values()];
  }

  async recordInstallation(tenantId: string, moduleId: string, version: string): Promise<void> {
    this.forTenant(tenantId).set(moduleId, { moduleId, status: "active", version, installedAt: new Date() });
  }

  async disable(tenantId: string, moduleId: string): Promise<void> {
    const records = this.forTenant(tenantId);
    const existing = records.get(moduleId);
    if (existing) records.set(moduleId, { ...existing, status: "disabled" });
  }

  seed(tenantId: string, record: ModuleInstallationRecord): void {
    this.forTenant(tenantId).set(record.moduleId, record);
  }
}
