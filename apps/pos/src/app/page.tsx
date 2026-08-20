"use client";

import { useEffect, useState } from "react";
import { SetupScreen } from "@/components/SetupScreen";
import { PosTerminal } from "@/components/PosTerminal";
import { getTerminalRecord, type TerminalRecord } from "@/lib/db";

export default function Page() {
  const [terminal, setTerminal] = useState<TerminalRecord | null | undefined>(undefined);

  useEffect(() => {
    void getTerminalRecord().then((record) => setTerminal(record ?? null));
  }, []);

  if (terminal === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  if (terminal === null) {
    return <SetupScreen onComplete={setTerminal} />;
  }

  return <PosTerminal terminal={terminal} />;
}
