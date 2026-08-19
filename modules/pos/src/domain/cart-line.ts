/**
 * A line item is a self-contained snapshot (sku/name/price captured at the
 * time it's added), not a foreign key to a Product row — no product catalog
 * exists yet (that's sales/inventory territory, Phase 9+). Real POS systems
 * do this anyway: a receipt shows the price *at time of sale*, not a live
 * join to a catalog that may have since changed price.
 */
export interface CartLine {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export function lineTotalCents(line: CartLine): number {
  return line.quantity * line.unitPriceCents;
}
