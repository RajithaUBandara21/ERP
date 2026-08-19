import { describe, expect, it } from "vitest";
import { getTenantBySlug } from "../src/application/get-tenant-by-slug";
import { TenantNotFoundError } from "../src/domain/tenant";
import { FakeTenantRepository } from "./fakes";

describe("getTenantBySlug", () => {
  it("returns the tenant when found", async () => {
    const repo = new FakeTenantRepository();
    repo.seed({ slug: "acme", name: "Acme", status: "active" });

    const tenant = await getTenantBySlug(repo, "acme");
    expect(tenant.slug).toBe("acme");
  });

  it("throws TenantNotFoundError when missing", async () => {
    const repo = new FakeTenantRepository();
    await expect(getTenantBySlug(repo, "missing")).rejects.toThrow(TenantNotFoundError);
  });
});
