import { tenantSlugSchema } from "@erp/validation";
import type { Tenant } from "../domain/tenant";
import type { TenantRepository } from "./tenant-repository";

export interface CreateTenantInput {
  slug: string;
  name: string;
}

/** Idempotent: re-running with the same slug returns the existing tenant, never a duplicate. */
export async function createTenant(repository: TenantRepository, input: CreateTenantInput): Promise<Tenant> {
  const slug = tenantSlugSchema.parse(input.slug);
  const name = input.name.trim();
  if (!name) {
    throw new Error("Tenant name must not be empty");
  }

  return repository.create({ slug, name });
}
