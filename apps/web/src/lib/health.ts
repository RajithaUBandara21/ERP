import { getControlPlaneDb } from "@erp/database";
import { sql } from "drizzle-orm";

export interface HealthResult {
  status: "ok" | "error";
  database: "ok" | "error";
  timestamp: string;
}

/**
 * Readiness check — verifies the control-plane database is reachable.
 * Deliberately does not check any individual tenant database: one
 * unreachable tenant database must not take down the whole application's
 * readiness signal. See docs/architecture/observability.md.
 */
export async function checkHealth(): Promise<HealthResult> {
  const timestamp = new Date().toISOString();

  try {
    const db = getControlPlaneDb();
    await db.execute(sql`SELECT 1`);
    return { status: "ok", database: "ok", timestamp };
  } catch {
    return { status: "error", database: "error", timestamp };
  }
}
