import { DrizzleTerminalRepository, POS_PERMISSIONS, registerTerminal } from "@erp/pos";
import { createLogger } from "@erp/logging";
import { stripUndefined, z } from "@erp/validation";
import { NextResponse } from "next/server";
import { withPermission } from "@/lib/with-permission";

const repository = new DrizzleTerminalRepository();
const logger = createLogger({ bindings: { module: "pos", operation: "register-terminal-route" } });

const registerTerminalSchema = z.object({
  name: z.string().min(1),
  deviceId: z.string().optional(),
});

export const POST = withPermission(POS_PERMISSIONS.TERMINAL_MANAGE, async (request, { tenant, tenantDb }) => {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => undefined);
  const parsed = registerTerminalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid terminal registration request", requestId }, { status: 400 });
  }

  try {
    const terminal = await registerTerminal(repository, tenantDb, stripUndefined(parsed.data));
    return NextResponse.json(terminal, { status: 201 });
  } catch (error) {
    logger.error("terminal registration failed unexpectedly", {
      requestId,
      tenantId: tenant.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
  }
});
