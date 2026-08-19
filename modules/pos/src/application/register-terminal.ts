import type { TenantDb } from "@erp/database";
import type { Terminal } from "../domain/terminal";
import type { TerminalRepository } from "./terminal-repository";

export interface RegisterTerminalInput {
  name: string;
  deviceId?: string;
}

export async function registerTerminal(
  repository: TerminalRepository,
  db: TenantDb,
  input: RegisterTerminalInput,
): Promise<Terminal> {
  const name = input.name.trim();
  if (!name) throw new Error("Terminal name must not be empty");

  return repository.create(db, { name, deviceId: input.deviceId ?? null });
}
