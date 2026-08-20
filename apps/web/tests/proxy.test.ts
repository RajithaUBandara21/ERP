import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy, TENANT_HOST_HINT_HEADER } from "../src/proxy";

describe("proxy", () => {
  it("passes the request through without redirecting or blocking it", () => {
    const request = new NextRequest("http://acme.platform.example.com:3000/api/tenant/whoami", {
      headers: { host: "acme.platform.example.com:3000" },
    });

    const response = proxy(request);

    // NextResponse.next() carries no redirect/rewrite Location and a 200-class status.
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("sets the normalized tenant host hint header on the forwarded request", () => {
    const request = new NextRequest("http://acme.platform.example.com:3000/api/tenant/whoami", {
      headers: { host: "Acme.Platform.Example.com:3000" },
    });

    const response = proxy(request);

    // Next.js communicates the rewritten *request* headers back via this
    // special response header prefix — see NextResponse.next({ request }).
    expect(response.headers.get(`x-middleware-request-${TENANT_HOST_HINT_HEADER}`)).toBe(
      "acme.platform.example.com",
    );
  });

  it("preserves an already-present hint instead of overwriting it from Host (apps/pos's same-origin rewrite relies on this)", () => {
    const request = new NextRequest("http://localhost:3000/api/pos/terminals", {
      headers: { host: "localhost:3000", [TENANT_HOST_HINT_HEADER]: "acme.platform.example.com" },
    });

    const response = proxy(request);

    expect(response.headers.get(`x-middleware-request-${TENANT_HOST_HINT_HEADER}`)).toBe("acme.platform.example.com");
  });
});
