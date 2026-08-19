import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withTenantContext } from "@/lib/with-tenant-context";

/**
 * Demonstrates the Phase 3 tenant-resolution pipeline end-to-end: resolves
 * the requesting tenant from its host and confirms its own database is
 * reachable. Anonymous (no session yet — see withTenantContext's doc
 * comment on the Phase 4 follow-up).
 */
export const GET = withTenantContext(async (_request, { tenant, tenantDb }) => {
  const [row] = (await tenantDb.execute(sql`SELECT current_database()`)) as unknown as [
    { current_database: string },
  ];

  return NextResponse.json({
    tenantId: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    database: row?.current_database,
  });
});
