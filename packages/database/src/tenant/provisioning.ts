/**
 * Tenant database provisioning skeleton — see DATABASE.md §3, ADR-0009, and
 * the tenant-provisioning flow in CLAUDE.md §45. This covers only "create a
 * database for this tenant and register it" (Phase 2 scope). Running
 * per-module migrations against the new database, creating the admin user,
 * and installing default modules are added in Phase 3+ as those pieces
 * exist.
 */
import { loadConfig } from "@erp/configuration";
import type { Logger } from "@erp/logging";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { getControlPlaneDb, schema } from "../control-plane/client";

function databaseNameForSlug(slug: string): string {
  const sanitized = slug.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return `tenant_${sanitized}`;
}

function connectionStringForDatabase(adminUrl: string, databaseName: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

/** Idempotent: creates the tenant's database only if it does not already exist. */
export async function createTenantDatabase(slug: string): Promise<string> {
  const config = loadConfig();
  const databaseName = databaseNameForSlug(slug);
  const admin = postgres(config.TENANT_DATABASE_ADMIN_URL, { max: 1 });

  try {
    const [existing] = await admin`SELECT 1 FROM pg_database WHERE datname = ${databaseName}`;
    if (!existing) {
      // CREATE DATABASE cannot be parameterized or run in a transaction block.
      await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await admin.end();
  }

  return connectionStringForDatabase(config.TENANT_DATABASE_ADMIN_URL, databaseName);
}

/** Idempotent: upserts the tenant's connection string into the control-plane registry. */
export async function registerTenantDatabase(tenantId: string, connectionString: string): Promise<void> {
  const db = getControlPlaneDb();
  await db
    .insert(schema.tenantDatabaseRegistry)
    .values({ tenantId, connectionString, placement: "local-dev" })
    .onConflictDoUpdate({
      target: schema.tenantDatabaseRegistry.tenantId,
      set: { connectionString, updatedAt: new Date() },
    });
}

export interface ProvisionTenantInput {
  slug: string;
  name: string;
}

export interface ProvisionTenantResult {
  tenantId: string;
  slug: string;
  databaseName: string;
}

/**
 * Idempotent tenant provisioning: create-or-reuse the control-plane tenant
 * row, create-or-reuse the tenant database, register its connection string.
 * Safe to re-run if a previous attempt failed partway (CLAUDE.md §45).
 */
export async function provisionTenant(
  input: ProvisionTenantInput,
  logger?: Logger,
): Promise<ProvisionTenantResult> {
  const db = getControlPlaneDb();

  const [existingTenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, input.slug)).limit(1);

  const tenant =
    existingTenant ??
    (await db.insert(schema.tenants).values({ slug: input.slug, name: input.name }).returning())[0];

  if (!tenant) {
    throw new Error(`Failed to create or load tenant with slug ${input.slug}`);
  }

  logger?.info("provisioning tenant database", { tenantId: tenant.id, operation: "provisionTenant" });

  const connectionString = await createTenantDatabase(tenant.slug);
  await registerTenantDatabase(tenant.id, connectionString);

  logger?.info("tenant provisioned", { tenantId: tenant.id, operation: "provisionTenant", status: "ok" });

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    databaseName: databaseNameForSlug(tenant.slug),
  };
}
