import type { Tenant } from "../src/domain/tenant";
import type { TenantRepository } from "../src/application/tenant-repository";

export class FakeTenantRepository implements TenantRepository {
  private readonly byId = new Map<string, Tenant>();
  private nextId = 1;

  seed(tenant: Omit<Tenant, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Tenant, "id">>): Tenant {
    const now = new Date();
    const full: Tenant = {
      id: tenant.id ?? `tenant-${this.nextId++}`,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(full.id, full);
    return full;
  }

  async findBySlug(slug: string): Promise<Tenant | undefined> {
    return [...this.byId.values()].find((t) => t.slug === slug);
  }

  async findById(id: string): Promise<Tenant | undefined> {
    return this.byId.get(id);
  }

  private readonly hostnameToTenantId = new Map<string, string>();

  mapHostname(hostname: string, tenantId: string): void {
    this.hostnameToTenantId.set(hostname, tenantId);
  }

  async findByHostname(hostname: string): Promise<Tenant | undefined> {
    const tenantId = this.hostnameToTenantId.get(hostname);
    return tenantId ? this.byId.get(tenantId) : undefined;
  }

  async create(input: { slug: string; name: string }): Promise<Tenant> {
    const existing = await this.findBySlug(input.slug);
    if (existing) return existing;
    return this.seed({ slug: input.slug, name: input.name, status: "active" });
  }
}
