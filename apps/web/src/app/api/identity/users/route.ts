import { DrizzleUserRepository, IDENTITY_PERMISSIONS } from "@erp/identity";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const userRepository = new DrizzleUserRepository();

/**
 * Sample permission-guarded endpoint demonstrating the full Phase 5 chain:
 * session → tenant → role → permission. Owner (wildcard) succeeds; Member
 * (no permissions) gets 403 — see apps/web/tests/permission-flow.integration.test.ts.
 */
export const GET = withPermission(IDENTITY_PERMISSIONS.USER_LIST, async (_request, { tenantDb }) => {
  const users = await userRepository.listAll(tenantDb);
  return NextResponse.json({
    users: users.map((user) => ({ id: user.id, email: user.email, name: user.name, roleId: user.roleId })),
  });
});
