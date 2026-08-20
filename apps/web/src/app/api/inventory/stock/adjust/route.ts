import { adjustStock, DrizzleStockRepository, DrizzleWarehouseRepository, INVENTORY_PERMISSIONS, InsufficientStockError } from "@erp/inventory";
import { createLogger } from "@erp/logging";
import { stripUndefined, z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const stockRepository = new DrizzleStockRepository();
const warehouseRepository = new DrizzleWarehouseRepository();
const logger = createLogger({ bindings: { module: "inventory", operation: "adjust-stock-route" } });

const adjustStockSchema = z.object({
  sku: z.string().min(1),
  delta: z.number().int().refine((value) => value !== 0, "delta must be non-zero"),
  warehouseId: z.string().uuid().optional(),
  reference: z.string().optional(),
});

export const POST = withPermission(INVENTORY_PERMISSIONS.STOCK_ADJUST, async (request, { tenant, tenantDb }) => {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => undefined);
  const parsed = adjustStockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid stock adjustment request", requestId }, { status: 400 });
  }

  try {
    const level = await adjustStock({ stockRepository, warehouseRepository }, tenantDb, stripUndefined(parsed.data));
    return NextResponse.json(level);
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ code: "INVENTORY_INSUFFICIENT_STOCK", message: error.message, requestId }, { status: 422 });
    }
    logger.error("stock adjustment failed unexpectedly", {
      requestId,
      tenantId: tenant.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
  }
});
