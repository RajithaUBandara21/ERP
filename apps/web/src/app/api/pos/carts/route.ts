import {
  createCart,
  DrizzleCartRepository,
  DrizzleTerminalRepository,
  POS_PERMISSIONS,
  TerminalNotActiveError,
  TerminalNotFoundError,
} from "@erp/pos";
import { createLogger } from "@erp/logging";
import { stripUndefined, z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const cartRepository = new DrizzleCartRepository();
const terminalRepository = new DrizzleTerminalRepository();
const logger = createLogger({ bindings: { module: "pos", operation: "create-cart-route" } });

const createCartSchema = z.object({
  terminalId: z.string().uuid(),
  customerId: z.string().optional(),
});

export const POST = withPermission(POS_PERMISSIONS.ORDER_CREATE, async (request, { tenant, tenantDb }) => {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => undefined);
  const parsed = createCartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid cart creation request", requestId }, { status: 400 });
  }

  try {
    const cart = await createCart(cartRepository, terminalRepository, tenantDb, stripUndefined(parsed.data));
    return NextResponse.json(cart, { status: 201 });
  } catch (error) {
    if (error instanceof TerminalNotFoundError) {
      return NextResponse.json({ code: "TERMINAL_NOT_FOUND", message: error.message, requestId }, { status: 404 });
    }
    if (error instanceof TerminalNotActiveError) {
      return NextResponse.json({ code: "TERMINAL_NOT_ACTIVE", message: error.message, requestId }, { status: 409 });
    }

    logger.error("cart creation failed unexpectedly", {
      requestId,
      tenantId: tenant.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
  }
});
