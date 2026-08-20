export interface Warehouse {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class WarehouseNotFoundError extends Error {
  constructor(id: string) {
    super(`Warehouse not found: ${id}`);
    this.name = "WarehouseNotFoundError";
  }
}
