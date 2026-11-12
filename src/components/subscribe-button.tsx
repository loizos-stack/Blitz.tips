"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, Bitcoin, Banknote, Copy } from "lucide-react";
import { formatCents, cn } from "@/lib/utils";

type PackageInterval = "WEEKLY" | "MONTHLY" | "ANNUAL";

const PASS_LENGTH: Record<PackageInterval, string> = {
  WEEKLY: "7-day",
  MONTHLY: "30-day",
  ANNUAL: "1-year",
};

const INTERVAL_SUFFIX: Record<PackageInterval, string> = {
  WEEKLY: "/wk",
  MONTHLY: "/mo",
  ANNUAL: "/yr",
};

const INTERVAL_LABEL: Record<PackageInterval, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  ANNUAL: "Annual",
};

const PERKS = ["Every premium pick, the moment it drops", "Verified, unedited track record", "Cancel anytime"];

export function SubscribeButton({
  handicapperId,
  displayName,
  packages,
  isSignedIn,
  isReady,
  isOwner = false,
  cryptoEnabled = false,
  /** Methods the platform accepts by transfer; empty means the option is off. */
  directMethods = [],
  trialDays = null,
  currency = "USD",
}: {
  handicapperId: string;
  displayName: string;
  // Cents per offered package; null = the handicapper doesn't offer it.
  packages: { WEEKLY: number | null; MONTHLY: number; ANNUAL: number | null };
  isSignedIn: boolean;
  isReady: boolean;
  isOwner?: boolean;
  cryptoEnabled?: boolean;
  directMethods?: string[];
  // Free-trial days on weekly/monthly card subscriptions (never annual/crypto).
  trialDays?: number | null;
  // The handicapper's pricing currency.
  currency?: "USD" | "EUR" | "GBP";
}) {
  const router = useRouter();
  const offered = (Object.keys(INTERVAL_SUFFIX) as PackageInterval[]).filter(
    (i) => packages[i] != null
  );
  const [interval, setInterval] = useState<PackageInterval>("MONTHLY");
  const [loading, setLoading] = useState(false);
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Off-platform transfer: no redirect, no provider. The request returns a
  // reference and the payment details, which stay on screen until paid.
  const [directOpen, setDirectOpen] = useState(false);
  const [directMethod, setDirectMethod] = useState(directMethods[0] ?? "");
  const [directNote, setDirectNote] = useState("");
  const [directLoading, setDirectLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ticket, setTicket] = useState<{
    reference: string;
    amountCents: number;
    currency: "USD" | "EUR" | "GBP";
    method: string;
    instructions: string;
    alreadyPending?: boolean;
  } | null>(null);

  // A free trial applies to card subscriptions on weekly/monthly only.
  const trialFor = (i: PackageInterval) => (trialDays && i !== "ANNUAL" ? trialDays : null);
  const activeTrial = trialFor(interval);

  // "Save X%" on the annual package relative to paying monthly for a year.
  const annualSavePct =
    packages.ANNUAL != null && packages.ANNUAL < packages.MONTHLY * 12
      ? Math.round((1 - packages.ANNUAL / (packages.MONTHLY * 12)) * 100)
      : null;

  async function handleClick() {
    if (!isSignedIn) {
      router.push(`/signin?callbackUrl=/handicappers`);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handicapperId, interval }),
    });

    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not start checkout");
      return;
    }
    if (body.url) window.location.href = body.url;
  }

  // A one-time crypto payment for a fixed access period (no auto-renew).
  async function handleCrypto() {
    if (!isSignedIn) {
      router.push(`/signin?callbackUrl=/handicappers`);
      return;
    }
    setCryptoLoading(true);
    setError(null);
    const res = await fetch("/api/crypto/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handicapperId, interval }),
    });
    const body = await res.json().catch(() => ({}));
    setCryptoLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not start crypto checkout");
      return;
    }
    if (body.url) window.location.href = body.url;
  }

  async function handleDirect() {
    if (!isSignedIn) {
      router.push(`/signin?callbackUrl=/handicappers`);
      return;
    }
    if (!directOpen) {
      setDirectOpen(true);
      return;
    }
    setDirectLoading(true);
    setError(null);
    const res = await fetch("/api/direct/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handicapperId, interval, method: directMethod, note: directNote }),
    });
    const body = await res.json().catch(() => ({}));
    setDirectLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not set up the transfer");
      return;
    }
    setTicket(body);
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-border bg-accent/10 px-5 py-4">
        <p className="flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4 text-accent" /> Premium picks
        </p>
        <p className="mt-1 text-xs text-muted">
          Unlock everything {displayName} posts, before the games start.
        </p>
      </div>

      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-2">
          {offered.map((i) => {
            const selected = interval === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setInterval(i)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors",
                  selected ? "border-accent bg-accent/10" : "border-border hover:border-muted"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border",
                      selected ? "border-accent" : "border-border"
                    )}
                  >
                    {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  <span className="text-sm font-medium">{INTERVAL_LABEL[i]}</span>
                </span>
                {/* Badge centered in the gap between the package name and price. */}
                <span className="flex flex-1 justify-center">
                  {i === "ANNUAL" && annualSavePct !== null && annualSavePct > 0 && (
                    <span className="whitespace-nowrap rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-white">
                      SAVE {annualSavePct}%
                    </span>
                  )}
                  {trialFor(i) && (
                    <span className="whitespace-nowrap rounded-full bg-danger px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {trialFor(i)}-DAY TRIAL
                    </span>
                  )}
                </span>
                <span className="text-sm font-bold tabular-nums">
                  {formatCents(packages[i]!, currency)}
                  <span className="font-normal text-muted">{INTERVAL_SUFFIX[i]}</span>
                </span>
              </button>
            );
          })}
        </div>

        <ul className="flex flex-col gap-1.5">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-1.5 text-xs text-muted">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              {perk}
            </li>
          ))}
        </ul>

        {isOwner ? (
          <>
            <Link
              href="/dashboard/handicapper"
              className="block rounded-lg border border-border py-2.5 text-center text-sm font-semibold hover:border-muted"
            >
              Edit your packages
            </Link>
            <p className="text-center text-[11px] text-muted">This is how subscribers see your pricing.</p>
          </>
        ) : (
          <>
            {/* Card checkout only once the handicapper's Stripe is live — it
                sits on top of the crypto option. Until then we simply don't show
                a card button (no disabled placeholder). */}
            {isReady && (
              <button
                onClick={handleClick}
                disabled={loading}
                className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Redirecting…"
                  : activeTrial
                    ? `Start ${activeTrial}-day trial`
                    : `Subscribe — ${formatCents(packages[interval]!, currency)}${INTERVAL_SUFFIX[interval]}`}
              </button>
            )}
            {cryptoEnabled && (
              <button
                onClick={handleCrypto}
                disabled={cryptoLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:border-muted disabled:opacity-60"
              >
                <Bitcoin className="h-4 w-4 text-gold" />
                {cryptoLoading ? "Redirecting…" : `Pay with crypto — ${formatCents(packages[interval]!, currency)}`}
              </button>
            )}
            {cryptoEnabled && (
              <p className="text-center text-[11px] text-muted">
                Crypto buys a one-time {PASS_LENGTH[interval]} pass — no auto-renew, we&rsquo;ll remind
                you before it ends.
              </p>
            )}

            {/* Paying the platform directly. Once a reference exists the
                button is gone and only the instructions remain: the next
                thing to do is make the transfer, not click anything here. */}
            {directMethods.length > 0 && !ticket && (
              <>
                <button
                  onClick={handleDirect}
                  disabled={directLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:border-muted disabled:opacity-60"
                >
                  <Banknote className="h-4 w-4 text-accent" />
                  {directLoading
                    ? "Setting up…"
                    : directOpen
                      ? `Get payment details — ${formatCents(packages[interval]!, currency)}`
                      : "Pay by bank transfer or PayPal"}
                </button>

                {directOpen && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <label className="block">
                      <span className="text-[11px] font-medium">Paying with</span>
                      <select
                        value={directMethod}
                        onChange={(e) => setDirectMethod(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
                      >
                        {directMethods.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium">
                        Anything that helps us spot it{" "}
                        <span className="text-muted">— optional</span>
                      </span>
                      <input
                        value={directNote}
                        onChange={(e) => setDirectNote(e.target.value)}
                        placeholder="e.g. the PayPal address it'll come from"
                        className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
                      />
                    </label>
                    <p className="text-[11px] text-muted">
                      A person checks each transfer, so access starts once we&rsquo;ve seen the
                      money — usually the same day, not the same minute.
                    </p>
                  </div>
                )}
              </>
            )}

            {ticket && (
              <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
                <p className="text-sm font-semibold">
                  {ticket.alreadyPending
                    ? "You already have a transfer waiting"
                    : `Send ${formatCents(ticket.amountCents, ticket.currency)} by ${ticket.method}`}
                </p>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-surface px-2 py-1 text-sm font-semibold tracking-wide">
                    {ticket.reference}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(ticket.reference).then(
                        () => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        },
                        () => undefined
                      );
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" /> {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-[11px] text-muted">
                  Put that reference on the transfer — it&rsquo;s how we match the money to you.
                </p>
                {/* Whitespace preserved: these are account details typed by a
                    person, and their line breaks are load-bearing. */}
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-surface p-2.5 text-xs">
                  {ticket.instructions}
                </pre>
                <p className="text-[11px] text-muted">
                  We&rsquo;ll let you know the moment it&rsquo;s confirmed, and your{" "}
                  {PASS_LENGTH[interval]} pass starts then.
                </p>
              </div>
            )}

            {!isReady && !cryptoEnabled && directMethods.length === 0 && (
              <p className="text-center text-[11px] text-muted">
                {displayName} hasn&rsquo;t enabled subscriptions yet.
              </p>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
