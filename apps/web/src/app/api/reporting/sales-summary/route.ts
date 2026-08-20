import { DrizzleSalesSummaryRepository, getSalesSummary, REPORTING_PERMISSIONS } from "@erp/reporting";
import { paginationCursorSchema, stripUndefined } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzleSalesSummaryRepository();

export const GET = withPermission(REPORTING_PERMISSIONS.SALES_READ, async (request, { tenantDb }) => {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const parsed = paginationCursorSchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid pagination parameters", requestId }, { status: 400 });
  }

  const page = await getSalesSummary(repository, tenantDb, stripUndefined(parsed.data));
  return NextResponse.json(page);
});
