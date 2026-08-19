import { DrizzleUserRepository } from "@erp/identity";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

const userRepository = new DrizzleUserRepository();

/**
 * Demonstrates the full Phase 4 pipeline: resolve tenant from host, require
 * a session whose tenantId matches that tenant, load the user from that
 * tenant's own database. See MULTI-TENANCY.md §2.
 */
export const GET = withAuth(async (_request, { tenant, tenantDb, session }) => {
  const user = await userRepository.findById(tenantDb, session.userId);
  if (!user) {
    return NextResponse.json({ code: "UNAUTHENTICATED", message: "Authentication required" }, { status: 401 });
  }

  return NextResponse.json({
    tenant: { id: tenant.id, slug: tenant.slug },
    user: { id: user.id, email: user.email, name: user.name },
  });
});
