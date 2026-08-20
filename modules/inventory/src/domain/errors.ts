/**
 * Thrown when a movement would drive onHand or reserved negative, or
 * reserved above onHand — CLAUDE.md §21: never a physically-impossible
 * negative quantity, unless negative inventory is explicitly enabled for
 * that tenant/product. No such opt-in exists yet (would need the feature-
 * flag system, Phase 47) — this error is always enforced for now.
 */
export class InsufficientStockError extends Error {
  constructor(
    public readonly sku: string,
    public readonly warehouseId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(`Insufficient stock for ${sku} in warehouse ${warehouseId}: requested ${requested}, available ${available}`);
    this.name = "InsufficientStockError";
  }
}
