import { DrizzleStockRepository, DrizzleWarehouseRepository, getStockLevel, INVENTORY_PERMISSIONS } from "@erp/inventory";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const stockRepository = new DrizzleStockRepository();
const warehouseRepository = new DrizzleWarehouseRepository();

export const GET = withPermission(INVENTORY_PERMISSIONS.STOCK_READ, async (request, { tenantDb }) => {
  const requestId = crypto.randomUUID();
  const sku = new URL(request.url).searchParams.get("sku");
  const warehouseId = new URL(request.url).searchParams.get("warehouseId") ?? undefined;
  if (!sku) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "sku query parameter is required", requestId }, { status: 400 });
  }

  const level = await getStockLevel(
    { stockRepository, warehouseRepository },
    tenantDb,
    { sku, ...(warehouseId ? { warehouseId } : {}) },
  );
  return NextResponse.json(level);
});
