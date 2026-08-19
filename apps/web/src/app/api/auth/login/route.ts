import { checkRateLimit, createSession, DrizzleSessionRepository } from "@erp/auth";
import { createLogger, recordAuditEvent } from "@erp/logging";
import { z } from "@erp/validation";
import { InvalidCredentialsError, UserNotActiveError, verifyCredentials, DrizzleUserRepository } from "@erp/identity";
import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { setSessionCookie } from "@/lib/session-cookie";
import { withTenantContext } from "@/lib/with-tenant-context";

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const userRepository = new DrizzleUserRepository();
const sessionRepository = new DrizzleSessionRepository();
const logger = createLogger({ bindings: { module: "identity", operation: "login" } });

/** Rate limit class: authentication — see SECURITY.md §5. */
const LOGIN_RATE_LIMIT = { limit: 10, windowMs: 5 * 60 * 1000 };

export const POST = withTenantContext(async (request, { tenant, tenantDb }) => {
  const requestId = crypto.randomUUID();
  const ip = getClientIp(request);

  const rateLimitResult = checkRateLimit(`login:${ip}:${tenant.id}`, LOGIN_RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Too many login attempts, try again later", requestId },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimitResult.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json().catch(() => undefined);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid login request", requestId }, { status: 400 });
  }

  try {
    const user = await verifyCredentials(userRepository, tenantDb, parsed.data);
    const { token, expiresAt } = await createSession(sessionRepository, { tenantId: tenant.id, userId: user.id });

    recordAuditEvent({ module: "identity", actor: user.id, tenantId: tenant.id, action: "auth.login", resource: "session", requestId, ip });

    const response = NextResponse.json({ id: user.id, email: user.email, name: user.name });
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (error) {
    if (error instanceof InvalidCredentialsError || error instanceof UserNotActiveError) {
      recordAuditEvent({ module: "identity", actor: null, tenantId: tenant.id, action: "auth.login_failed", resource: "session", requestId, ip });
      return NextResponse.json({ code: "INVALID_CREDENTIALS", message: "Invalid email or password", requestId }, { status: 401 });
    }

    logger.error("login failed unexpectedly", {
      requestId,
      tenantId: tenant.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, { status: 500 });
  }
});
