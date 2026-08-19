import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { getControlPlaneDb, schema } from "../control-plane/client";
import { TenantConnectionRegistry } from "./connection-registry";

/**
 * No tenant-side Drizzle schema exists yet — each business module owns and
 * contributes its own schema under its own infrastructure/persistence/ once
 * implemented (see DATABASE.md §5). Until then this is an untyped handle
 * good enough for connectivity checks (e.g. the Phase 2 health route).
 */
export type TenantDb = PostgresJsDatabase;

async function resolveTenantConnectionString(tenantId: string): Promise<string> {
  const controlPlaneDb = getControlPlaneDb();
  const [registration] = await controlPlaneDb
    .select({ connectionString: schema.tenantDatabaseRegistry.connectionString })
    .from(schema.tenantDatabaseRegistry)
    .where(eq(schema.tenantDatabaseRegistry.tenantId, tenantId))
    .limit(1);

  if (!registration) {
    throw new Error(`No tenant database registered for tenant ${tenantId}`);
  }
  return registration.connectionString;
}

let registry: TenantConnectionRegistry<TenantDb> | undefined;

/** The process-wide tenant connection registry — see MULTI-TENANCY.md §3. */
export function getTenantConnectionRegistry(): TenantConnectionRegistry<TenantDb> {
  if (registry) return registry;

  registry = new TenantConnectionRegistry<TenantDb>({
    resolveConnectionString: resolveTenantConnectionString,
    createConnection: (connectionString) => {
      const sql = postgres(connectionString, { max: 3 });
      return { db: drizzle(sql), close: () => sql.end() };
    },
    maxSize: 20,
  });
  return registry;
}

/** Resolves (opening if necessary) the Drizzle client for a tenant's database. */
export async function getTenantDb(tenantId: string): Promise<TenantDb> {
  return getTenantConnectionRegistry().get(tenantId);
}
