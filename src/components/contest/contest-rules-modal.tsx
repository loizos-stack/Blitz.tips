"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";

export interface ContestRulesInfo {
  name: string;
  minPicks: number;
  winners: number;
  prizeLabel: string;
  dateRange: string;
}

// Rules a user must read and accept before entering a contest. The "Accept &
// enter" action stays disabled until the acknowledgement box is ticked.
export function ContestRulesModal({
  rules,
  onAccept,
  onClose,
  loading,
  error,
}: {
  rules: ContestRulesInfo;
  onAccept: () => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [accepted, setAccepted] = useState(false);

  const items = [
    "Free to enter. One entry per person — duplicate or multiple accounts are disqualified.",
    "Open to registered users who are of legal age to participate where they live.",
    "Single picks only — parlays are not allowed in the contest.",
    `You must post at least ${rules.minPicks} graded (settled) picks to qualify for the leaderboard and prizes.`,
    "Entrants are ranked by ROI — net units won divided by units risked — across their settled picks.",
    "Every pick must be submitted before the event starts; you can't post on a game already underway or one after the contest ends.",
    "Results are graded by Blitz.tips and are final.",
    `The top ${rules.winners} finishers split the ${rules.prizeLabel} guaranteed prize pool. Contest runs ${rules.dateRange}.`,
    "Blitz.tips may disqualify any entry for manipulation, collusion, or abuse, and may adjust the rules if needed.",
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contest-rules-title"
    >
      <div className="card flex max-h-[85vh] w-full max-w-lg flex-col p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          <ScrollText className="h-5 w-5 text-accent" />
          <h2 id="contest-rules-title" className="text-lg font-bold">
            {rules.name} — Rules
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ol className="flex flex-col gap-3 text-sm text-foreground">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-bold text-muted">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted">
            By entering you agree to these rules and to our Terms &amp; Conditions.
          </p>
        </div>

        <div className="border-t border-border px-6 py-4">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-surface-raised p-3 text-sm font-medium">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="h-4 w-4" />
            I have read and accept the contest rules
          </label>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!accepted || loading}
              className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Entering…" : "Accept & enter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
