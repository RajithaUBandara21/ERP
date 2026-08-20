import {
  assignDriver,
  DELIVERY_PERMISSIONS,
  DeliveryNotAssignableError,
  DeliveryNotFoundError,
  DriverNotActiveError,
  DriverNotFoundError,
  DrizzleDeliveryAssignmentRepository,
  DrizzleDeliveryRepository,
  DrizzleDriverRepository,
} from "@erp/delivery";
import { createLogger } from "@erp/logging";
import { z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const deliveryRepository = new DrizzleDeliveryRepository();
const driverRepository = new DrizzleDriverRepository();
const assignmentRepository = new DrizzleDeliveryAssignmentRepository();
const logger = createLogger({ bindings: { module: "delivery", operation: "assign-driver-route" } });

const assignSchema = z.object({ driverId: z.string().uuid() });

export const POST = withPermission<{ deliveryId: string }>(
  DELIVERY_PERMISSIONS.DELIVERY_ASSIGN,
  async (request, { tenant, tenantDb, params }) => {
    const requestId = crypto.randomUUID();
    const body = await request.json().catch(() => undefined);
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid assignment request", requestId }, { status: 400 });
    }

    try {
      const delivery = await assignDriver(
        { deliveryRepository, driverRepository, assignmentRepository },
        tenantDb,
        { deliveryId: params.deliveryId, driverId: parsed.data.driverId },
      );
      return NextResponse.json(delivery);
    } catch (error) {
      if (error instanceof DeliveryNotFoundError) {
        return NextResponse.json({ code: "DELIVERY_NOT_FOUND", message: error.message, requestId }, { status: 404 });
      }
      if (error instanceof DriverNotFoundError) {
        return NextResponse.json({ code: "DRIVER_NOT_FOUND", message: error.message, requestId }, { status: 404 });
      }
      if (error instanceof DeliveryNotAssignableError) {
        return NextResponse.json({ code: "DELIVERY_NOT_ASSIGNABLE", message: error.message, requestId }, { status: 409 });
      }
      if (error instanceof DriverNotActiveError) {
        return NextResponse.json({ code: "DRIVER_NOT_ACTIVE", message: error.message, requestId }, { status: 409 });
      }

      logger.error("driver assignment failed unexpectedly", {
        requestId,
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  },
);
