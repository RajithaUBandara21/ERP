import type { NextRequest } from "next/server";

/** Best-effort client IP for rate-limit keying — see packages/auth's rate-limit.ts for its limitations. */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return "unknown";
}
