import {
  AlwaysSucceedsPaymentCapturePort,
  CartNotFoundError,
  CartNotOpenError,
  checkout,
  DrizzleCartRepository,
  DrizzlePosTransactionRepository,
  EmptyCartError,
  NoopStockReservationPort,
  PaymentCaptureFailedError,
  POS_PERMISSIONS,
} from "@erp/pos";
import { createLogger } from "@erp/logging";
import { stripUndefined, z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const cartRepository = new DrizzleCartRepository();
const transactionRepository = new DrizzlePosTransactionRepository();
// Phase 8 stand-ins — see modules/pos's application/{stock-reservation,payment-capture}-port.ts.
// Replaced with real Phase 9/10 implementations without this route changing.
const stockReservationPort = new NoopStockReservationPort();
const paymentCapturePort = new AlwaysSucceedsPaymentCapturePort();
const logger = createLogger({ bindings: { module: "pos", operation: "checkout-route" } });

const checkoutSchema = z.object({
  idempotencyKey: z.string().min(1),
  paymentMethod: z.string().min(1),
  taxCents: z.number().int().nonnegative().optional(),
});

export const POST = withPermission<{ cartId: string }>(
  POS_PERMISSIONS.ORDER_CREATE,
  async (request, { tenant, tenantDb, params }) => {
    const requestId = crypto.randomUUID();
    const body = await request.json().catch(() => undefined);
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid checkout request", requestId }, { status: 400 });
    }

    try {
      const transaction = await checkout(
        { cartRepository, transactionRepository, stockReservationPort, paymentCapturePort },
        tenantDb,
        tenant.id,
        { cartId: params.cartId, ...stripUndefined(parsed.data) },
      );
      return NextResponse.json(transaction, { status: 201 });
    } catch (error) {
      if (error instanceof CartNotFoundError) {
        return NextResponse.json({ code: "CART_NOT_FOUND", message: error.message, requestId }, { status: 404 });
      }
      if (error instanceof CartNotOpenError) {
        return NextResponse.json({ code: "CART_NOT_OPEN", message: error.message, requestId }, { status: 409 });
      }
      if (error instanceof EmptyCartError) {
        return NextResponse.json({ code: "CART_EMPTY", message: error.message, requestId }, { status: 422 });
      }
      if (error instanceof PaymentCaptureFailedError) {
        return NextResponse.json({ code: "PAYMENT_FAILED", message: error.message, requestId }, { status: 402 });
      }

      logger.error("checkout failed unexpectedly", {
        requestId,
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
    }
  },
);
