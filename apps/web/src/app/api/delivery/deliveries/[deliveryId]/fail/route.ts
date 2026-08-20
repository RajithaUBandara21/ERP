import { DELIVERY_PERMISSIONS, DeliveryNotFoundError, DrizzleDeliveryRepository, failDelivery, DeliveryNotFailableError } from "@erp/delivery";
import { createLogger } from "@erp/logging";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzleDeliveryRepository();
const logger = createLogger({ bindings: { module: "delivery", operation: "fail-delivery-route" } });

export const POST = withPermission<{ deliveryId: string }>(
  DELIVERY_PERMISSIONS.DELIVERY_ASSIGN,
  async (_request, { tenant, tenantDb, params }) => {
    const requestId = crypto.randomUUID();
    try {
      const delivery = await failDelivery(repository, tenantDb, params.deliveryId);
      return NextResponse.json(delivery);
    } catch (error) {
      if (error instanceof DeliveryNotFoundError) {
        return NextResponse.json({ code: "DELIVERY_NOT_FOUND", message: error.message, requestId }, { status: 404 });
      }
      if (error instanceof DeliveryNotFailableError) {
        return NextResponse.json({ code: "DELIVERY_NOT_FAILABLE", message: error.message, requestId }, { status: 409 });
      }

      logger.error("delivery fail-marking failed unexpectedly", {
        requestId,
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  },
);
