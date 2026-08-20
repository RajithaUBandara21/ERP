import { DELIVERY_PERMISSIONS, DrizzleDriverRepository, registerDriver } from "@erp/delivery";
import { createLogger } from "@erp/logging";
import { z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzleDriverRepository();
const logger = createLogger({ bindings: { module: "delivery", operation: "drivers-route" } });

const registerDriverSchema = z.object({ name: z.string().min(1) });

export const GET = withPermission(DELIVERY_PERMISSIONS.DRIVER_MANAGE, async (_request, { tenantDb }) => {
  const drivers = await repository.list(tenantDb);
  return NextResponse.json({ drivers });
});

export const POST = withPermission(DELIVERY_PERMISSIONS.DRIVER_MANAGE, async (request, { tenant, tenantDb }) => {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => undefined);
  const parsed = registerDriverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid driver registration request", requestId }, { status: 400 });
  }

  try {
    const driver = await registerDriver(repository, tenantDb, parsed.data);
    return NextResponse.json(driver, { status: 201 });
  } catch (error) {
    logger.error("driver registration failed unexpectedly", {
      requestId,
      tenantId: tenant.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
  }
});
