import { tenantSlugSchema } from "@erp/validation";
import type { Tenant } from "../domain/tenant";
import { TenantNotFoundError } from "../domain/tenant";
import type { TenantRepository } from "./tenant-repository";

export async function getTenantBySlug(repository: TenantRepository, slug: string): Promise<Tenant> {
  const parsedSlug = tenantSlugSchema.parse(slug);
  const tenant = await repository.findBySlug(parsedSlug);
  if (!tenant) {
    throw new TenantNotFoundError(parsedSlug);
  }
  return tenant;
}
