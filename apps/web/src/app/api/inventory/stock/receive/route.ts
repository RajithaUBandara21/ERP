import { DrizzleStockRepository, DrizzleWarehouseRepository, INVENTORY_PERMISSIONS, receiveStock } from "@erp/inventory";
import { createLogger } from "@erp/logging";
import { stripUndefined, z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const stockRepository = new DrizzleStockRepository();
const warehouseRepository = new DrizzleWarehouseRepository();
const logger = createLogger({ bindings: { module: "inventory", operation: "receive-stock-route" } });

const receiveStockSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  warehouseId: z.string().uuid().optional(),
  reference: z.string().optional(),
});

export const POST = withPermission(INVENTORY_PERMISSIONS.STOCK_RECEIVE, async (request, { tenant, tenantDb }) => {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => undefined);
  const parsed = receiveStockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid stock receipt request", requestId }, { status: 400 });
  }

  try {
    const level = await receiveStock({ stockRepository, warehouseRepository }, tenantDb, stripUndefined(parsed.data));
    return NextResponse.json(level, { status: 201 });
  } catch (error) {
    logger.error("stock receipt failed unexpectedly", {
      requestId,
      tenantId: tenant.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
  }
});
