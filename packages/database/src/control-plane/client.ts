import { loadConfig } from "@erp/configuration";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type ControlPlaneDb = PostgresJsDatabase<typeof schema>;

let sql: postgres.Sql | undefined;
let db: ControlPlaneDb | undefined;

/** Lazily-constructed, memoized control-plane connection (small pool — this is a single shared database). */
export function getControlPlaneDb(): ControlPlaneDb {
  if (db) return db;

  const config = loadConfig();
  sql = postgres(config.CONTROL_PLANE_DATABASE_URL, { max: 5 });
  db = drizzle(sql, { schema });
  return db;
}

/** Closes the control-plane connection pool — used by scripts/tests on shutdown. */
export async function closeControlPlaneDb(): Promise<void> {
  await sql?.end();
  sql = undefined;
  db = undefined;
}

export { schema };
