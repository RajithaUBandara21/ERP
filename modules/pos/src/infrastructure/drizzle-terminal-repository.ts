import type { TenantDb } from "@erp/database";
import { eq } from "drizzle-orm";
import type { Terminal, TerminalStatus } from "../domain/terminal";
import type { TerminalRepository } from "../application/terminal-repository";
import { terminals } from "./persistence/schema";

function toDomain(row: typeof terminals.$inferSelect): Terminal {
  return {
    id: row.id,
    name: row.name,
    deviceId: row.deviceId,
    status: row.status as TerminalStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleTerminalRepository implements TerminalRepository {
  async findById(db: TenantDb, id: string): Promise<Terminal | undefined> {
    const [row] = await db.select().from(terminals).where(eq(terminals.id, id)).limit(1);
    return row ? toDomain(row) : undefined;
  }

  async create(db: TenantDb, input: { name: string; deviceId: string | null }): Promise<Terminal> {
    const [row] = await db.insert(terminals).values(input).returning();
    if (!row) throw new Error(`Failed to create terminal '${input.name}'`);
    return toDomain(row);
  }
}
