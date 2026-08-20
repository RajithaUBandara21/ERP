import { createDelivery, DELIVERY_PERMISSIONS, DrizzleDeliveryRepository } from "@erp/delivery";
import { createLogger } from "@erp/logging";
import { z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzleDeliveryRepository();
const logger = createLogger({ bindings: { module: "delivery", operation: "deliveries-route" } });

const createDeliverySchema = z.object({ orderReference: z.string().min(1) });

export const GET = withPermission(DELIVERY_PERMISSIONS.DELIVERY_CREATE, async (_request, { tenantDb }) => {
  const deliveries = await repository.list(tenantDb);
  return NextResponse.json({ deliveries });
});

export const POST = withPermission(DELIVERY_PERMISSIONS.DELIVERY_CREATE, async (request, { tenant, tenantDb }) => {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => undefined);
  const parsed = createDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid delivery creation request", requestId }, { status: 400 });
  }

  try {
    const delivery = await createDelivery(repository, tenantDb, parsed.data);
    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    logger.error("delivery creation failed unexpectedly", {
      requestId,
      tenantId: tenant.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
  }
});
