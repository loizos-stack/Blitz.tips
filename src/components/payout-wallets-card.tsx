"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";

// Where the platform sends the handicapper's cut of crypto (NOWPayments)
// subscriptions. Internal — these addresses are never shown to subscribers.
export function PayoutWalletsCard({
  payoutEthAddress,
  payoutBtcAddress,
  onSaved,
}: {
  payoutEthAddress: string | null;
  payoutBtcAddress: string | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [eth, setEth] = useState(payoutEthAddress ?? "");
  const [btc, setBtc] = useState(payoutBtcAddress ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setError(null);
    const res = await fetch("/api/handicapper/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutEthAddress: eth.trim(), payoutBtcAddress: btc.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not save wallets");
      setState("error");
      return;
    }
    setState("saved");
    onSaved?.();
    router.refresh();
  }

  const input =
    "mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-xs outline-none focus:border-accent";

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Crypto payout wallets</p>
          <p className="text-sm text-muted">
            Where we send your cut when a subscriber pays in crypto. Optional and private — never shown on
            your profile.
          </p>

          <div className="mt-3 flex max-w-lg flex-col gap-3">
            <label className="block">
              <span className="text-xs text-muted">ETH (ERC-20) address</span>
              <input
                value={eth}
                onChange={(e) => {
                  setEth(e.target.value);
                  setState("idle");
                }}
                placeholder="0x…"
                className={input}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">BTC address</span>
              <input
                value={btc}
                onChange={(e) => {
                  setBtc(e.target.value);
                  setState("idle");
                }}
                placeholder="bc1… or 1… / 3…"
                className={input}
              />
            </label>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={state === "saving"}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              {state === "saving" ? "Saving…" : "Save wallets"}
            </button>
            {state === "saved" && <span className="text-sm font-medium text-accent">Saved ✓</span>}
            {error && <span className="text-sm text-danger">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
