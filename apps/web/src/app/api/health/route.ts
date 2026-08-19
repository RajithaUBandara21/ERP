import { createLogger } from "@erp/logging";
import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/health";

const logger = createLogger({ bindings: { module: "core", operation: "health" } });

export async function GET(): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  const result = await checkHealth();
  const durationMs = Date.now() - start;

  logger.info("health check", { requestId, status: result.status, durationMs });

  return NextResponse.json(result, { status: result.status === "ok" ? 200 : 503 });
}
