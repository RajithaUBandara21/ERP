export type DriverStatus = "active" | "inactive";

export interface Driver {
  id: string;
  name: string;
  status: DriverStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class DriverNotFoundError extends Error {
  constructor(id: string) {
    super(`Driver not found: ${id}`);
    this.name = "DriverNotFoundError";
  }
}

export class DriverNotActiveError extends Error {
  constructor(id: string) {
    super(`Driver is not active: ${id}`);
    this.name = "DriverNotActiveError";
  }
}
