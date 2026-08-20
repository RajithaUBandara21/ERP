import { applyEventsMigrations } from "@erp/events";

/**
 * core itself owns no tenant-DB tables — this hook exists because the
 * outbox (packages/events) needs to exist for ANY module to publish
 * events, and core is the always-installed foundational module every
 * tenant has active first (see module.manifest.ts's doc comment and
 * packages/events/src/apply-migrations.ts's doc comment for why the
 * outbox's own migration runs through here rather than events having its
 * own ModuleManifest entry).
 */
export async function applyCoreMigrations(tenantId: string): Promise<void> {
  await applyEventsMigrations(tenantId);
}
