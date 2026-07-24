"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { MAX_PICKS_PER_DAY, MAX_PICKS_PER_WEEK, MAX_UNITS_PER_DAY } from "@/lib/contest-limits";

export interface ContestRulesInfo {
  name: string;
  minPicks: number;
  winners: number;
  prizeLabel: string;
  dateRange: string;
  registrationCloses: string;
  dynamicPayouts: boolean;
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
    `Registration closes ${rules.registrationCloses}. After that no new entries are accepted, and the number of paid places is locked for the rest of the contest.`,
    "Single picks only — parlays are not allowed in the contest.",
    `Daily limit: up to ${MAX_PICKS_PER_DAY} picks and ${MAX_UNITS_PER_DAY} total units per day.`,
    `Weekly limit: up to ${MAX_PICKS_PER_WEEK} picks per week. Both quotas reset automatically — daily at midnight UTC, weekly on Monday.`,
    `You must post at least ${rules.minPicks} graded (settled) picks to qualify for the leaderboard and prizes.`,
    "Entrants are ranked by volume-adjusted ROI: your return on units risked, but a fixed block of break-even units is added in, so your ROI only counts fully once you've posted real volume. A small hot streak can't top a full season — posting consistently all contest long is rewarded over hitting the minimum and stopping.",
    "Every pick must be submitted before the event starts; you can't post on a game already underway or one after the contest ends.",
    "Results are graded by Blitz.tips and are final.",
    rules.dynamicPayouts
      ? `Paid places scale with the field: the top 3 are paid, plus one more place for every 10 entrants who join. The full ${rules.prizeLabel} guaranteed pool is split across those places by ICM, re-calculated as people join and locked when registration closes. Contest runs ${rules.dateRange}.`
      : `The top ${rules.winners} finishers split the ${rules.prizeLabel} guaranteed prize pool. Contest runs ${rules.dateRange}.`,
    "Integrity: we log the IP address and device used for every entry and every pick. Multiple accounts, entries sharing an IP or device, collusion, or any manipulation lead to disqualification and forfeiture of any prize.",
    "Blitz.tips may disqualify any entry, remove an entrant, or adjust the rules to protect the integrity of the contest. All decisions are final.",
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

        <div className="flex-1 overflow-y-auto px-6 py-4 text-left">
          <ol className="flex flex-col gap-3 text-left text-sm text-foreground">
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
