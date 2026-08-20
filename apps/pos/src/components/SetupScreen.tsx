"use client";

import { useState } from "react";
import { setupTerminal } from "@/lib/setup-terminal";
import type { TerminalRecord } from "@/lib/db";

export function SetupScreen({ onComplete }: { onComplete: (record: TerminalRecord) => void }) {
  const [tenantHost, setTenantHost] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      const record = await setupTerminal({ tenantHost, email, password, terminalName });
      onComplete(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed — check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Set up this terminal</h1>
        <p className="mt-1 text-sm text-slate-500">
          One-time, online-only registration (CLAUDE.md §18). Once complete, this terminal works offline.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Field label="Tenant host" htmlFor="tenantHost">
            <input
              id="tenantHost"
              required
              placeholder="acme.platform.example.com"
              value={tenantHost}
              onChange={(e) => setTenantHost(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </Field>
          <Field label="Terminal name" htmlFor="terminalName">
            <input
              id="terminalName"
              required
              placeholder="Front Counter"
              value={terminalName}
              onChange={(e) => setTerminalName(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </Field>
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </Field>

          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Setting up…" : "Register terminal"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}
