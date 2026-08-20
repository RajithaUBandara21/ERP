import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { getControlPlaneDb, schema } from "../control-plane/client";
import { TenantConnectionRegistry } from "./connection-registry";

/**
 * No shared tenant-side Drizzle schema exists — each business module owns
 * and contributes its own schema under its own infrastructure/persistence/
 * (DATABASE.md §5), so this stays an untyped handle rather than a
 * schema-bound one.
 *
 * A union with the transaction-callback type, not just PostgresJsDatabase
 * alone (Phase 13, outbox pattern): ADR-0004 requires a business write and
 * its outbox event to land in the exact same database transaction, which
 * means repository functions typed to accept TenantDb must also accept
 * the `tx` handle a caller's `db.transaction(async (tx) => { ... })`
 * passes them — PostgresJsDatabase and the transaction object are
 * separate (non-inheriting) classes that both extend a common PgDatabase
 * base, so without this union, passing `tx` into a function typed
 * `db: TenantDb` would be a type error even though it works correctly at
 * runtime. Inferred from `.transaction()`'s own declared signature
 * (rather than importing the transaction class by name) so this stays
 * correct even if drizzle-orm renames or stops exporting that class.
 */
export type TenantDb =
  | PostgresJsDatabase
  | (Parameters<PostgresJsDatabase["transaction"]>[0] extends (tx: infer TTransaction, ...rest: never[]) => unknown
      ? TTransaction
      : never);

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
