import { createLogger } from "@erp/logging";
import { DrizzleSessionRepository, SessionInvalidError, validateSessionToken, type Session } from "@erp/auth";
import type { TenantContext } from "@erp/tenant";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionTokenFromRequest } from "./session-cookie";
import { withTenantContext } from "./with-tenant-context";

const sessionRepository = new DrizzleSessionRepository();
const logger = createLogger({ bindings: { module: "identity", operation: "withAuth" } });

export interface AuthContext extends TenantContext {
  session: Session;
}

export type AuthRouteHandler<TParams extends Record<string, string> = Record<string, never>> = (
  request: NextRequest,
  context: AuthContext & { params: TParams },
) => Promise<Response> | Response;

/**
 * Composes withTenantContext with session validation — this is
 * MULTI-TENANCY.md §2's "target" flow: resolve tenant from host, THEN
 * require a session whose tenantId matches that resolved tenant (rejecting
 * on any mismatch, per validateSessionToken's doc comment). Every endpoint
 * that requires an authenticated user goes through this, never re-deriving
 * tenant/session logic itself (CLAUDE.md §59, avoid duplicated business rules).
 */
export function withAuth<TParams extends Record<string, string> = Record<string, never>>(
  handler: AuthRouteHandler<TParams>,
) {
  return withTenantContext<TParams>(async (request, tenantContext) => {
    const requestId = crypto.randomUUID();
    const token = getSessionTokenFromRequest(request);

    if (!token) {
      return unauthenticated(requestId);
    }

    try {
      const session = await validateSessionToken(sessionRepository, token, tenantContext.tenant.id);
      return await handler(request, { ...tenantContext, session });
    } catch (error) {
      if (error instanceof SessionInvalidError) {
        logger.warn("session invalid", { requestId, tenantId: tenantContext.tenant.id });
        return unauthenticated(requestId);
      }

      logger.error("auth check failed", {
        requestId,
        tenantId: tenantContext.tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  });
}

function unauthenticated(requestId: string): NextResponse {
  return NextResponse.json(
    { code: "UNAUTHENTICATED", message: "Authentication required", requestId },
    { status: 401 },
  );
}
