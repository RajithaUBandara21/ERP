export type { CartLine } from "./domain/cart-line";
export { lineTotalCents } from "./domain/cart-line";

export { CartNotFoundError, CartNotOpenError, EmptyCartError } from "./domain/cart";
export type { Cart, CartStatus } from "./domain/cart";

export { TerminalNotActiveError, TerminalNotFoundError } from "./domain/terminal";
export type { Terminal, TerminalStatus } from "./domain/terminal";

export { TransactionNotFoundError } from "./domain/pos-transaction";
export type { PosTransaction, PosTransactionStatus } from "./domain/pos-transaction";

export { POS_PERMISSIONS } from "./domain/permissions";
export type { PosPermission } from "./domain/permissions";

export type { TerminalRepository } from "./application/terminal-repository";
export { DrizzleTerminalRepository } from "./infrastructure/drizzle-terminal-repository";

export type { CartRepository } from "./application/cart-repository";
export { DrizzleCartRepository } from "./infrastructure/drizzle-cart-repository";

export type { CreatePosTransactionInput, PosTransactionRepository } from "./application/pos-transaction-repository";
export { DrizzlePosTransactionRepository } from "./infrastructure/drizzle-pos-transaction-repository";

export type { StockReservationPort } from "./application/stock-reservation-port";
export { NoopStockReservationPort } from "./infrastructure/noop-stock-reservation-port";
export { InventoryStockReservationPort } from "./infrastructure/inventory-stock-reservation-port";

export type { PaymentCaptureResult, PaymentCapturePort } from "./application/payment-capture-port";
export { AlwaysSucceedsPaymentCapturePort } from "./infrastructure/always-succeeds-payment-capture-port";
export { PaymentsCapturePort } from "./infrastructure/payments-capture-port";

export { registerTerminal } from "./application/register-terminal";
export type { RegisterTerminalInput } from "./application/register-terminal";

export { createCart } from "./application/create-cart";
export { addCartLine } from "./application/add-cart-line";
export type { AddCartLineInput } from "./application/add-cart-line";
export { removeCartLine } from "./application/remove-cart-line";

export { checkout, PaymentCaptureFailedError } from "./application/checkout";
export type { CheckoutDependencies, CheckoutInput } from "./application/checkout";

export { applyPosMigrations } from "./apply-migrations";
export { posManifest } from "./module.manifest";
