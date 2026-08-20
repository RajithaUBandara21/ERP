"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { completeSaleOffline } from "@/lib/complete-sale";
import { listPendingSales, type PendingSale, type PendingSaleLine, type TerminalRecord } from "@/lib/db";
import { useOnlineStatus } from "@/lib/online-status";
import { drainSyncQueue } from "@/lib/sync-queue";

const SYNC_INTERVAL_MS = 15_000;

export function PosTerminal({ terminal }: { terminal: TerminalRecord }) {
  const isOnline = useOnlineStatus();
  const [cart, setCart] = useState<PendingSaleLine[]>([]);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [paymentMethodToken, setPaymentMethodToken] = useState("");
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [lastSaleMessage, setLastSaleMessage] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const skuInputRef = useRef<HTMLInputElement>(null);

  const refreshPendingSales = useCallback(async () => {
    setPendingSales(await listPendingSales());
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      await drainSyncQueue(terminal.tenantHost, terminal.terminalId);
    } finally {
      setSyncing(false);
      await refreshPendingSales();
    }
  }, [terminal.tenantHost, terminal.terminalId, refreshPendingSales]);

  useEffect(() => {
    void refreshPendingSales();
    void sync();
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    const interval = setInterval(() => void sync(), SYNC_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [sync, refreshPendingSales]);

  function addLine(event: React.FormEvent) {
    event.preventDefault();
    const priceCents = Math.round(Number.parseFloat(unitPrice || "0") * 100);
    const qty = Number.parseInt(quantity, 10);
    if (!sku.trim() || !name.trim() || !Number.isFinite(priceCents) || priceCents <= 0 || !Number.isFinite(qty) || qty <= 0) return;

    setCart((lines) => [...lines, { sku: sku.trim(), name: name.trim(), quantity: qty, unitPriceCents: priceCents }]);
    setSku("");
    setName("");
    setQuantity("1");
    setUnitPrice("");
    skuInputRef.current?.focus();
  }

  function removeLine(index: number) {
    setCart((lines) => lines.filter((_, i) => i !== index));
  }

  async function completeSale() {
    if (cart.length === 0) return;
    const sale = await completeSaleOffline({
      lines: cart,
      paymentMethod,
      ...(paymentMethod === "card" && paymentMethodToken ? { paymentMethodToken } : {}),
    });
    setCart([]);
    setLastSaleMessage(`Sale completed (${sale.idempotencyKey}) — syncing in background.`);
    await refreshPendingSales();
    void sync();
  }

  const subtotalCents = cart.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
  const unsyncedCount = pendingSales.filter((s) => s.status !== "synced").length;

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{terminal.terminalName}</h1>
          <p className="text-xs text-slate-500">{terminal.tenantHost}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge isOnline={isOnline} />
          <button
            type="button"
            onClick={() => void sync()}
            disabled={!isOnline || syncing}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : `Sync now${unsyncedCount > 0 ? ` (${unsyncedCount})` : ""}`}
          </button>
        </div>
      </header>

      {lastSaleMessage ? (
        <p role="status" className="mb-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {lastSaleMessage}
        </p>
      ) : null}

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-700">Add item</h2>
        <form className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5" onSubmit={addLine}>
          <input
            ref={skuInputRef}
            placeholder="SKU"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
          <input
            type="number"
            min="1"
            placeholder="Qty"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Price"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Add
          </button>
        </form>
      </section>

      <section className="mt-4 rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-700">Cart</h2>
        {cart.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No items yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {cart.map((line, index) => (
              <li key={`${line.sku}-${index}`} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {line.quantity} × {line.name} <span className="text-slate-400">({line.sku})</span>
                </span>
                <span className="flex items-center gap-3">
                  {formatCents(line.quantity * line.unitPriceCents)}
                  <button type="button" onClick={() => removeLine(index)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-medium">
          <span>Total</span>
          <span>{formatCents(subtotalCents)}</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as "cash" | "card")}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
          {paymentMethod === "card" ? (
            <input
              placeholder="Payment token (try tok_declined)"
              value={paymentMethodToken}
              onChange={(e) => setPaymentMethodToken(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          ) : null}
          <button
            type="button"
            onClick={() => void completeSale()}
            disabled={cart.length === 0}
            className="ml-auto rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Complete sale
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-700">Pending sales ({pendingSales.length})</h2>
        {pendingSales.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {pendingSales.map((sale) => (
              <li key={sale.localId} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-600">{sale.idempotencyKey}</span>
                <SaleStatusBadge sale={sale} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${isOnline ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
    >
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}

function SaleStatusBadge({ sale }: { sale: PendingSale }) {
  const styles: Record<PendingSale["status"], string> = {
    pending: "bg-slate-100 text-slate-700",
    syncing: "bg-blue-100 text-blue-800",
    synced: "bg-emerald-100 text-emerald-800",
    failed: "bg-amber-100 text-amber-800",
    conflict: "bg-red-100 text-red-800",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[sale.status]}`} title={sale.lastError}>
      {sale.status}
    </span>
  );
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
