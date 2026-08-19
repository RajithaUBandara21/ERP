import { getControlPlaneDb, schema } from "@erp/database";
import { and, eq } from "drizzle-orm";
import type { ModuleInstallationRecord, ModuleRegistryRepository } from "../application/module-registry-repository";

export class DrizzleModuleRegistryRepository implements ModuleRegistryRepository {
  async findInstalled(tenantId: string, moduleId: string): Promise<ModuleInstallationRecord | undefined> {
    const db = getControlPlaneDb();

    const [moduleRow] = await db
      .select()
      .from(schema.tenantModules)
      .where(and(eq(schema.tenantModules.tenantId, tenantId), eq(schema.tenantModules.moduleId, moduleId)))
      .limit(1);
    if (!moduleRow) return undefined;

    const [versionRow] = await db
      .select()
      .from(schema.moduleVersions)
      .where(and(eq(schema.moduleVersions.tenantId, tenantId), eq(schema.moduleVersions.moduleId, moduleId)))
      .limit(1);

    return {
      moduleId,
      status: moduleRow.status as "active" | "disabled",
      version: versionRow?.version ?? "0.0.0",
      installedAt: moduleRow.installedAt,
    };
  }

  async listInstalled(tenantId: string): Promise<ModuleInstallationRecord[]> {
    const db = getControlPlaneDb();

    const moduleRows = await db.select().from(schema.tenantModules).where(eq(schema.tenantModules.tenantId, tenantId));
    const versionRows = await db.select().from(schema.moduleVersions).where(eq(schema.moduleVersions.tenantId, tenantId));
    const versionByModuleId = new Map(versionRows.map((row) => [row.moduleId, row.version]));

    return moduleRows.map((row) => ({
      moduleId: row.moduleId,
      status: row.status as "active" | "disabled",
      version: versionByModuleId.get(row.moduleId) ?? "0.0.0",
      installedAt: row.installedAt,
    }));
  }

  async recordInstallation(tenantId: string, moduleId: string, version: string): Promise<void> {
    const db = getControlPlaneDb();
    const now = new Date();

    await db
      .insert(schema.tenantModules)
      .values({ tenantId, moduleId, status: "active", installedAt: now })
      .onConflictDoUpdate({
        target: [schema.tenantModules.tenantId, schema.tenantModules.moduleId],
        set: { status: "active", installedAt: now, updatedAt: now },
      });

    await db
      .insert(schema.moduleVersions)
      .values({ tenantId, moduleId, version, installedAt: now })
      .onConflictDoUpdate({
        target: [schema.moduleVersions.tenantId, schema.moduleVersions.moduleId],
        set: { version, installedAt: now, updatedAt: now },
      });
  }

  async disable(tenantId: string, moduleId: string): Promise<void> {
    const db = getControlPlaneDb();
    await db
      .update(schema.tenantModules)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(and(eq(schema.tenantModules.tenantId, tenantId), eq(schema.tenantModules.moduleId, moduleId)));
  }
}
