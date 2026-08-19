import { createLogger } from "@erp/logging";
import {
  DrizzleTenantRepository,
  resolveTenantContext,
  TenantNotActiveError,
  TenantNotFoundError,
  type TenantContext,
} from "@erp/tenant";
import { NextResponse, type NextRequest } from "next/server";
import { TENANT_HOST_HINT_HEADER } from "@/proxy";

const repository = new DrizzleTenantRepository();
const logger = createLogger({ bindings: { module: "tenant", operation: "withTenantContext" } });

/** Next.js's dynamic route segment context — `params` has been a Promise since Next 15's async dynamic APIs. */
export interface RouteContext<TParams extends Record<string, string> = Record<string, never>> {
  params: Promise<TParams>;
}

export type TenantRouteHandler<TParams extends Record<string, string> = Record<string, never>> = (
  request: NextRequest,
  context: TenantContext & { params: TParams },
) => Promise<Response> | Response;

/**
 * Composition helper implementing MULTI-TENANCY.md §2's request flow for
 * the Node runtime: resolve tenant from the (untrusted) host hint set by
 * middleware, reject cleanly if it doesn't resolve to an active tenant.
 *
 * Interim trust model (see resolveTenantContext's doc comment): this alone
 * is sufficient for anonymous, pre-authentication tenant resolution. Once
 * Phase 4 introduces sessions, protected routes must additionally verify
 * session.tenantId === context.tenant.id and reject on mismatch — this
 * helper's contract will be extended then, not replaced.
 *
 * Threads through Next's route params (e.g. `[moduleId]`) unchanged — this
 * helper only adds tenant context, it never inspects params itself.
 */
export function withTenantContext<TParams extends Record<string, string> = Record<string, never>>(
  handler: TenantRouteHandler<TParams>,
) {
  return async (request: NextRequest, routeContext?: RouteContext<TParams>): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const host = request.headers.get(TENANT_HOST_HINT_HEADER) ?? request.headers.get("host") ?? "";

    try {
      const params = routeContext ? await routeContext.params : ({} as TParams);
      const context = await resolveTenantContext(repository, host);
      return await handler(request, { ...context, params });
    } catch (error) {
      if (error instanceof TenantNotFoundError) {
        logger.warn("tenant not found", { requestId, host });
        return NextResponse.json(
          { code: "TENANT_NOT_FOUND", message: "No tenant is registered for this host", requestId },
          { status: 404 },
        );
      }
      if (error instanceof TenantNotActiveError) {
        logger.warn("tenant not active", { requestId, host });
        return NextResponse.json(
          { code: "TENANT_NOT_ACTIVE", message: "This tenant is not currently active", requestId },
          { status: 403 },
        );
      }

      logger.error("tenant context resolution failed", {
        requestId,
        host,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  };
}
