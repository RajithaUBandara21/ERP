import type { Tenant } from "../domain/tenant";

/**
 * Port (dependency-inversion boundary) implemented by
 * infrastructure/repositories — see ARCHITECTURE.md §3.
 */
export interface TenantRepository {
  findBySlug(slug: string): Promise<Tenant | undefined>;
  findById(id: string): Promise<Tenant | undefined>;
  findByHostname(hostname: string): Promise<Tenant | undefined>;
  /** Idempotent: returns the existing tenant if the slug is already taken. */
  create(input: { slug: string; name: string }): Promise<Tenant>;
}
