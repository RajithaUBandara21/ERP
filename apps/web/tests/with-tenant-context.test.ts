import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type * as ErpTenant from "@erp/tenant";

vi.mock("@erp/tenant", async () => {
  const actual = await vi.importActual<typeof ErpTenant>("@erp/tenant");
  return {
    ...actual,
    DrizzleTenantRepository: vi.fn(),
    resolveTenantContext: vi.fn(),
  };
});

async function loadFresh() {
  vi.resetModules();
  const { withTenantContext } = await import("../src/lib/with-tenant-context");
  const tenantModule = await import("@erp/tenant");
  return { withTenantContext, tenantModule };
}

function requestFor(host: string, hint?: string): NextRequest {
  return new NextRequest(`http://${host}/api/tenant/whoami`, {
    headers: hint ? { "x-tenant-host-hint": hint, host } : { host },
  });
}

describe("withTenantContext", () => {
  it("invokes the handler with the resolved context on success", async () => {
    const { withTenantContext, tenantModule } = await loadFresh();
    const fakeContext = { tenant: { id: "t1", slug: "acme", name: "Acme", status: "active" } };
    vi.mocked(tenantModule.resolveTenantContext).mockResolvedValue(fakeContext as never);

    const handler = vi.fn(async () => new Response("ok"));
    const wrapped = withTenantContext(handler);

    const response = await wrapped(requestFor("acme.platform.example.com", "acme.platform.example.com"));

    expect(handler).toHaveBeenCalledWith(expect.anything(), { ...fakeContext, params: {} });
    expect(response.status).toBe(200);
  });

  it("returns 404 TENANT_NOT_FOUND when resolution fails to find a tenant", async () => {
    const { withTenantContext, tenantModule } = await loadFresh();
    vi.mocked(tenantModule.resolveTenantContext).mockRejectedValue(
      new tenantModule.TenantNotFoundError("unknown.platform.example.com"),
    );

    const wrapped = withTenantContext(vi.fn());
    const response = await wrapped(requestFor("unknown.platform.example.com", "unknown.platform.example.com"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("TENANT_NOT_FOUND");
    expect(body.requestId).toBeTruthy();
  });

  it("returns 403 TENANT_NOT_ACTIVE when the tenant is suspended", async () => {
    const { withTenantContext, tenantModule } = await loadFresh();
    vi.mocked(tenantModule.resolveTenantContext).mockRejectedValue(
      new tenantModule.TenantNotActiveError("acme", "suspended"),
    );

    const wrapped = withTenantContext(vi.fn());
    const response = await wrapped(requestFor("acme.platform.example.com", "acme.platform.example.com"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("TENANT_NOT_ACTIVE");
  });

  it("never leaks internal error details in the response body", async () => {
    const { withTenantContext, tenantModule } = await loadFresh();
    vi.mocked(tenantModule.resolveTenantContext).mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:5432"));

    const wrapped = withTenantContext(vi.fn());
    const response = await wrapped(requestFor("acme.platform.example.com", "acme.platform.example.com"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toMatch(/10\.0\.0\.5|ECONNREFUSED/);
  });
});
