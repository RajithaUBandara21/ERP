import type { Plan } from "../domain/plan";

/** Port (dependency-inversion boundary) implemented by infrastructure/repositories — see ARCHITECTURE.md §3. */
export interface PlanRepository {
  findByCode(code: string): Promise<Plan | undefined>;
  findById(id: string): Promise<Plan | undefined>;
  list(): Promise<Plan[]>;
  /** Idempotent: upserts by code — safe to call on every bootstrap, same pattern as identity's seedDefaultRoles. */
  upsert(input: {
    code: string;
    name: string;
    includedModules: string[];
    userLimit: number | null;
    priceCents: number;
    billingInterval: "monthly" | "yearly";
  }): Promise<Plan>;
}
