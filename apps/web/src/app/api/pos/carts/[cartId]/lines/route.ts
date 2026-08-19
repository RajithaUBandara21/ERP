import { addCartLine, CartNotFoundError, CartNotOpenError, DrizzleCartRepository, POS_PERMISSIONS } from "@erp/pos";
import { createLogger } from "@erp/logging";
import { z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const cartRepository = new DrizzleCartRepository();
const logger = createLogger({ bindings: { module: "pos", operation: "add-cart-line-route" } });

const addLineSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});

export const POST = withPermission<{ cartId: string }>(
  POS_PERMISSIONS.ORDER_CREATE,
  async (request, { tenant, tenantDb, params }) => {
    const requestId = crypto.randomUUID();
    const body = await request.json().catch(() => undefined);
    const parsed = addLineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid cart line request", requestId }, { status: 400 });
    }

    try {
      const cart = await addCartLine(cartRepository, tenantDb, params.cartId, parsed.data);
      return NextResponse.json(cart);
    } catch (error) {
      if (error instanceof CartNotFoundError) {
        return NextResponse.json({ code: "CART_NOT_FOUND", message: error.message, requestId }, { status: 404 });
      }
      if (error instanceof CartNotOpenError) {
        return NextResponse.json({ code: "CART_NOT_OPEN", message: error.message, requestId }, { status: 409 });
      }

      logger.error("add cart line failed unexpectedly", {
        requestId,
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  },
);
