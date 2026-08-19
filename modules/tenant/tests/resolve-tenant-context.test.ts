import { describe, expect, it, vi } from "vitest";

vi.mock("@erp/database", () => ({
  getTenantDb: vi.fn(async (tenantId: string) => ({ __fakeDbFor: tenantId })),
}));

async function loadFresh() {
  vi.resetModules();
  const { resolveTenantContext } = await import("../src/application/resolve-tenant-context");
  const { FakeTenantRepository } = await import("./fakes");
  return { resolveTenantContext, FakeTenantRepository };
}

describe("resolveTenantContext", () => {
  it("resolves a tenant by subdomain label and returns its own db handle", async () => {
    const { resolveTenantContext, FakeTenantRepository } = await loadFresh();
    const repo = new FakeTenantRepository();
    const acme = repo.seed({ slug: "acme", name: "Acme", status: "active" });

    const context = await resolveTenantContext(repo, "acme.platform.example.com:3000");

    expect(context.tenant.id).toBe(acme.id);
    expect((context.tenantDb as unknown as { __fakeDbFor: string }).__fakeDbFor).toBe(acme.id);
  });

  it("resolves a verified custom domain over a subdomain guess", async () => {
    const { resolveTenantContext, FakeTenantRepository } = await loadFresh();
    const repo = new FakeTenantRepository();
    const acme = repo.seed({ slug: "acme", name: "Acme", status: "active" });
    repo.mapHostname("shop.acme-custom.com", acme.id);

    const context = await resolveTenantContext(repo, "shop.acme-custom.com");
    expect(context.tenant.id).toBe(acme.id);
  });

  it("rejects an unknown host rather than falling back to any default tenant", async () => {
    const { resolveTenantContext, FakeTenantRepository } = await loadFresh();
    const repo = new FakeTenantRepository();
    repo.seed({ slug: "acme", name: "Acme", status: "active" });

    await expect(resolveTenantContext(repo, "unknown-tenant.platform.example.com")).rejects.toThrow();
  });

  it("rejects a suspended tenant even though the host resolves", async () => {
    const { resolveTenantContext, FakeTenantRepository } = await loadFresh();
    const repo = new FakeTenantRepository();
    repo.seed({ slug: "suspended-co", name: "Suspended Co", status: "suspended" });

    await expect(resolveTenantContext(repo, "suspended-co.platform.example.com")).rejects.toThrow(/not active/i);
  });

  it("resolution depends only on the host — a client-supplied slug elsewhere in the request is never consulted", async () => {
    // resolveTenantContext's signature only accepts (repository, host) — there is
    // no parameter through which a caller could pass an alternate/spoofed tenant
    // identifier. This test documents that contract: two different tenants
    // resolved from two different hosts always get their own, distinct db handle.
    const { resolveTenantContext, FakeTenantRepository } = await loadFresh();
    const repo = new FakeTenantRepository();
    const acme = repo.seed({ slug: "acme", name: "Acme", status: "active" });
    const globex = repo.seed({ slug: "globex", name: "Globex", status: "active" });

    const acmeContext = await resolveTenantContext(repo, "acme.platform.example.com");
    const globexContext = await resolveTenantContext(repo, "globex.platform.example.com");

    expect(acmeContext.tenant.id).toBe(acme.id);
    expect(globexContext.tenant.id).toBe(globex.id);
    expect((acmeContext.tenantDb as unknown as { __fakeDbFor: string }).__fakeDbFor).not.toBe(
      (globexContext.tenantDb as unknown as { __fakeDbFor: string }).__fakeDbFor,
    );
  });
});
