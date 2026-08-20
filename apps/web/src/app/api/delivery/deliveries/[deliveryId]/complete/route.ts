import { completeDelivery, DELIVERY_PERMISSIONS, DeliveryNotCompletableError, DeliveryNotFoundError, DrizzleDeliveryRepository } from "@erp/delivery";
import { createLogger } from "@erp/logging";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzleDeliveryRepository();
const logger = createLogger({ bindings: { module: "delivery", operation: "complete-delivery-route" } });

export const POST = withPermission<{ deliveryId: string }>(
  DELIVERY_PERMISSIONS.DELIVERY_COMPLETE,
  async (_request, { tenant, tenantDb, params }) => {
    const requestId = crypto.randomUUID();
    try {
      const delivery = await completeDelivery(repository, tenantDb, params.deliveryId);
      return NextResponse.json(delivery);
    } catch (error) {
      if (error instanceof DeliveryNotFoundError) {
        return NextResponse.json({ code: "DELIVERY_NOT_FOUND", message: error.message, requestId }, { status: 404 });
      }
      if (error instanceof DeliveryNotCompletableError) {
        return NextResponse.json({ code: "DELIVERY_NOT_COMPLETABLE", message: error.message, requestId }, { status: 409 });
      }

      logger.error("delivery completion failed unexpectedly", {
        requestId,
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  },
);
