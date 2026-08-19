import type { TenantDb } from "@erp/database";
import type { Terminal } from "../domain/terminal";

export interface TerminalRepository {
  findById(db: TenantDb, id: string): Promise<Terminal | undefined>;
  create(db: TenantDb, input: { name: string; deviceId: string | null }): Promise<Terminal>;
}
