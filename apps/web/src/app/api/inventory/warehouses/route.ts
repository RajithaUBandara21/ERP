import { createWarehouse, DrizzleWarehouseRepository, INVENTORY_PERMISSIONS } from "@erp/inventory";
import { createLogger } from "@erp/logging";
import { stripUndefined, z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzleWarehouseRepository();
const logger = createLogger({ bindings: { module: "inventory", operation: "warehouses-route" } });

const createWarehouseSchema = z.object({
  name: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export const GET = withPermission(INVENTORY_PERMISSIONS.WAREHOUSE_MANAGE, async (_request, { tenantDb }) => {
  const warehouses = await repository.list(tenantDb);
  return NextResponse.json({ warehouses });
});

export const POST = withPermission(INVENTORY_PERMISSIONS.WAREHOUSE_MANAGE, async (request, { tenant, tenantDb }) => {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => undefined);
  const parsed = createWarehouseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid warehouse request", requestId }, { status: 400 });
  }

  try {
    const warehouse = await createWarehouse(repository, tenantDb, stripUndefined(parsed.data));
    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    logger.error("warehouse creation failed unexpectedly", {
      requestId,
      tenantId: tenant.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
  }
});
