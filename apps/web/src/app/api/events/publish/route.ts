import { CORE_PERMISSIONS } from "@erp/core";
import { DrizzleOutboxRepository, publishPendingEvents } from "@erp/events";
import { createLogger } from "@erp/logging";
import { NextResponse } from "next/server";
import { getEventConsumers } from "@/lib/event-consumers";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzleOutboxRepository();
const logger = createLogger({ bindings: { module: "core", operation: "publish-events-route" } });

/**
 * No background job scheduler exists yet (CLAUDE.md §27) to drain the
 * outbox on its own — this is the on-demand trigger until one does (see
 * publishPendingEvents's doc comment). Owner-only by default (CORE.EVENTS.
 * PUBLISH isn't granted to the seeded "member" role).
 */
export const POST = withPermission(CORE_PERMISSIONS.EVENTS_PUBLISH, async (_request, { tenant, tenantDb }) => {
  const requestId = crypto.randomUUID();
  try {
    const result = await publishPendingEvents(repository, tenantDb, getEventConsumers());
    return NextResponse.json(result);
  } catch (error) {
    logger.error("event publishing failed unexpectedly", {
      requestId,
      tenantId: tenant.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
  }
});
