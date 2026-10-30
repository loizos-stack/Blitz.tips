import Link from "next/link";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { formatCents } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  MIN_SETTLED_PICKS,
  PRIZE_CENTS,
  PRIZE_POOL_CENTS,
  monthLabel,
  startsOnLabel,
  type MonthlyStanding,
  type PrizePhase,
} from "@/lib/monthly-prizes";

/** "+2.40u" / "−1.66u", with the real minus sign. */
function units(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}u`;
}

const PLACE = ["1st", "2nd", "3rd"];
const MEDAL = ["text-yellow-500", "text-zinc-400", "text-amber-700"];

/**
 * The monthly prize race, above the all-time leaderboard.
 *
 * Shows the three paying places filled in with whoever currently holds them,
 * and an empty slot where nobody qualifies yet. An empty slot is the honest
 * state early in a month and it is also the most motivating one: a capper
 * looking at a blank 3rd place can see exactly what it would take.
 */
export function MonthlyPrizeBoard({
  month,
  standings,
  phase = "live",
  frozen,
}: {
  month: string;
  standings: MonthlyStanding[];
  /** "upcoming" before the first month opens: announced, not yet running. */
  phase?: PrizePhase;
  /** True once the month is recorded — the race is over and this is the result. */
  frozen?: boolean;
}) {
  const winners = standings.filter((s) => s.rank !== null && s.rank <= PRIZE_CENTS.length);
  const contenders = standings.filter((s) => s.eligible).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gold/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gold" />
          <div>
            <h2 className="font-semibold">
              {formatCents(PRIZE_POOL_CENTS)} — {monthLabel(month)}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {phase === "upcoming"
                ? `Starts ${startsOnLabel()}.`
                : frozen
                  ? "Final standings."
                  : "Live. Best net units this month wins."}{" "}
              {formatCents(PRIZE_CENTS[0])} / {formatCents(PRIZE_CENTS[1])} /{" "}
              {formatCents(PRIZE_CENTS[2])}.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted">
          {phase === "upcoming"
            ? "Everyone starts on zero"
            : `${contenders} ${contenders === 1 ? "capper has" : "cappers have"} qualified`}
        </p>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-3">
        {PRIZE_CENTS.map((cents, i) => {
          const held = winners.find((w) => w.rank === i + 1);
          return (
            <div key={i} className="bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className={cn("text-sm font-bold", MEDAL[i])}>{PLACE[i]}</span>
                <span className="text-sm font-bold tabular-nums">{formatCents(cents)}</span>
              </div>

              {held ? (
                <Link
                  href={`/handicappers/${held.handle}`}
                  className="group mt-3 flex items-center gap-2.5"
                >
                  <Avatar
                    src={held.avatarUrl}
                    name={held.displayName}
                    className="h-9 w-9 shrink-0 rounded-full"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold group-hover:text-accent">
                      {held.displayName}
                    </span>
                    <span className="block text-xs text-muted">
                      <span
                        className={cn(
                          "font-medium",
                          held.stats.unitsNet > 0
                            ? "text-accent"
                            : held.stats.unitsNet < 0
                              ? "text-danger"
                              : ""
                        )}
                      >
                        {units(held.stats.unitsNet)}
                      </span>{" "}
                      · {held.stats.record}
                    </span>
                  </span>
                </Link>
              ) : phase === "upcoming" ? (
                <p className="mt-3 text-xs text-muted">Open. Nobody has a head start.</p>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  Open — no one has {MIN_SETTLED_PICKS} settled picks here yet.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* The rules, said plainly and in the same place as the money. A prize
          whose terms live on another page is a prize people argue about. */}
      <p className="border-t border-border px-5 py-3 text-xs text-muted">
        Ranked on net units from picks <strong>settled</strong> during the month, minimum{" "}
        {MIN_SETTLED_PICKS} settled picks to qualify. Ties break to the bigger sample. Paid after
        the month closes.
      </p>
    </div>
  );
}
