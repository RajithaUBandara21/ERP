import { CORE_PERMISSIONS, DrizzleModuleRegistryRepository, installModule } from "@erp/core";
import { createLogger } from "@erp/logging";
import { NextResponse } from "next/server";
import { getModuleRegistry } from "@/lib/module-registry";
import { moduleErrorResponse } from "@/lib/module-error-response";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzleModuleRegistryRepository();
const logger = createLogger({ bindings: { module: "core", operation: "install-module-route" } });

export const POST = withPermission<{ moduleId: string }>(
  CORE_PERMISSIONS.MODULE_MANAGE,
  async (_request, { tenant, session, params }) => {
    const requestId = crypto.randomUUID();
    const { moduleId } = params;

    try {
      await installModule(getModuleRegistry(), repository, tenant.id, moduleId, session.userId);
      return NextResponse.json({ moduleId, status: "active" });
    } catch (error) {
      const mapped = moduleErrorResponse(error, requestId);
      if (mapped) return mapped;

      logger.error("module install failed unexpectedly", {
        requestId,
        tenantId: tenant.id,
        moduleId,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  },
);
