import { createLogger } from "@erp/logging";
import { PermissionDeniedError, requirePermission } from "@erp/authorization";
import { DrizzleRoleRepository, DrizzleUserRepository, getUserPermissions } from "@erp/identity";
import { NextResponse, type NextRequest } from "next/server";
import { type AuthContext, withAuth } from "./with-auth";

const userRepository = new DrizzleUserRepository();
const roleRepository = new DrizzleRoleRepository();
const logger = createLogger({ bindings: { module: "identity", operation: "withPermission" } });

export type PermissionRouteHandler<TParams extends Record<string, string> = Record<string, never>> = (
  request: NextRequest,
  context: AuthContext & { params: TParams },
) => Promise<Response> | Response;

/**
 * Composes withAuth with a permission check — the full session → tenant →
 * role → permission chain from MULTI-TENANCY.md §2 / ADR-0007. Branch/
 * warehouse scoping is not implemented yet (Phase 5 scope decision — see
 * packages/authorization's doc comment); this checks only the flat
 * permission string.
 */
export function withPermission<TParams extends Record<string, string> = Record<string, never>>(
  permission: string,
  handler: PermissionRouteHandler<TParams>,
) {
  return withAuth<TParams>(async (request, context) => {
    const requestId = crypto.randomUUID();

    try {
      const permissions = await getUserPermissions(userRepository, roleRepository, context.tenantDb, context.session.userId);
      requirePermission(permissions, permission);
      return await handler(request, context);
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        logger.warn("permission denied", {
          requestId,
          tenantId: context.tenant.id,
          userId: context.session.userId,
          permission,
        });
        return NextResponse.json(
          { code: "PERMISSION_DENIED", message: "You do not have permission to perform this action", requestId },
          { status: 403 },
        );
      }

      logger.error("permission check failed", {
        requestId,
        tenantId: context.tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  });
}
