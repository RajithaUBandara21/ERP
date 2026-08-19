import { DrizzleSessionRepository, revokeSession } from "@erp/auth";
import { recordAuditEvent } from "@erp/logging";
import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { clearSessionCookie, getSessionTokenFromRequest } from "@/lib/session-cookie";
import { withTenantContext } from "@/lib/with-tenant-context";

const sessionRepository = new DrizzleSessionRepository();

/** Deliberately uses withTenantContext, not withAuth — logging out an already-expired/invalid session must still succeed. */
export const POST = withTenantContext(async (request, { tenant }) => {
  const requestId = crypto.randomUUID();
  const token = getSessionTokenFromRequest(request);

  if (token) {
    await revokeSession(sessionRepository, token);
    recordAuditEvent({
      module: "identity",
      actor: null,
      tenantId: tenant.id,
      action: "auth.logout",
      resource: "session",
      requestId,
      ip: getClientIp(request),
    });
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
});
