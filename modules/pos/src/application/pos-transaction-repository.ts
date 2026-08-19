import type { TenantDb } from "@erp/database";
import type { PosTransaction } from "../domain/pos-transaction";

export interface CreatePosTransactionInput {
  terminalId: string;
  cartId: string | null;
  customerId: string | null;
  lines: PosTransaction["lines"];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paymentMethod: string;
  idempotencyKey: string;
}

export interface PosTransactionRepository {
  findByIdempotencyKey(db: TenantDb, idempotencyKey: string): Promise<PosTransaction | undefined>;
  create(db: TenantDb, input: CreatePosTransactionInput): Promise<PosTransaction>;
}
