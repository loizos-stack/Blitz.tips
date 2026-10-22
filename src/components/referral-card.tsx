"use client";

import { useState } from "react";
import { Check, Copy, Users } from "lucide-react";

/**
 * A user's referral link and what it has brought in.
 *
 * Shows the handicapper count separately from the total, because on a two-sided
 * marketplace those are different achievements — readers are welcome, but a
 * capper who brings another capper has done the thing the business actually
 * needs.
 */
export function ReferralCard({
  baseUrl,
  code,
  total,
  handicappers,
}: {
  baseUrl: string;
  code: string;
  total: number;
  handicappers: number;
}) {
  const link = `${baseUrl}/r/${code}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false); // clipboard blocked; the link is selectable on screen
    }
  }

  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Users className="h-4 w-4 text-accent" /> Invite a handicapper
      </p>
      <p className="mt-1 text-sm text-muted">
        Anyone who signs up through your link is credited to you — permanently, from the moment
        they create their account.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-surface-raised px-3 py-2 font-mono text-sm">
          {link}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-4 flex gap-6">
        <div>
          <p className="text-2xl font-bold tabular-nums">{total}</p>
          <p className="text-xs text-muted">signed up</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-accent">{handicappers}</p>
          <p className="text-xs text-muted">became handicappers</p>
        </div>
      </div>
    </div>
  );
}
