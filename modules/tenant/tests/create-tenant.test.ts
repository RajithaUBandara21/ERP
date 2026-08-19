import { describe, expect, it } from "vitest";
import { createTenant } from "../src/application/create-tenant";
import { FakeTenantRepository } from "./fakes";

describe("createTenant", () => {
  it("creates a tenant with a valid slug", async () => {
    const repo = new FakeTenantRepository();
    const tenant = await createTenant(repo, { slug: "acme-retail", name: "Acme Retail" });

    expect(tenant.slug).toBe("acme-retail");
    expect(tenant.status).toBe("active");
  });

  it("is idempotent — re-running with the same slug returns the existing tenant", async () => {
    const repo = new FakeTenantRepository();
    const first = await createTenant(repo, { slug: "acme-retail", name: "Acme Retail" });
    const second = await createTenant(repo, { slug: "acme-retail", name: "Acme Retail (renamed attempt)" });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Acme Retail"); // create() does not overwrite an existing tenant's name
  });

  it("rejects an invalid slug", async () => {
    const repo = new FakeTenantRepository();
    await expect(createTenant(repo, { slug: "Not A Slug!", name: "x" })).rejects.toThrow();
  });

  it("rejects an empty name", async () => {
    const repo = new FakeTenantRepository();
    await expect(createTenant(repo, { slug: "acme", name: "   " })).rejects.toThrow(/name/i);
  });
});
