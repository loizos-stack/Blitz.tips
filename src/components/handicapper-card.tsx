import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { formatCents, SPORT_LABELS } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import { SportIcon } from "@/components/sport-icon";
import type { HandicapperSummary } from "@/lib/handicappers";

export function HandicapperCard({ handicapper, rank }: { handicapper: HandicapperSummary; rank?: number }) {
  const { stats } = handicapper;

  return (
    <Link
      href={`/handicappers/${handicapper.handle}`}
      className={`card group flex flex-col overflow-hidden p-0 transition-colors hover:border-accent/60 ${
        handicapper.isFeatured ? "border-gold/50 bg-gold/5" : ""
      }`}
    >
      <div className="relative h-20 w-full overflow-hidden bg-gradient-to-r from-accent/20 via-surface-raised to-gold/15">
        {handicapper.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded cover (Vercel Blob URL)
          <img src={handicapper.coverUrl} alt="" className="h-full w-full object-cover" />
        )}
        {rank !== undefined && (
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-bold text-white">
            #{rank}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
        <div className="flex items-center gap-3">
          <Avatar
            src={handicapper.avatarUrl}
            name={handicapper.displayName}
            className="-mt-8 h-16 w-16 shrink-0 rounded-full border-4 border-surface text-base"
          />
          <div className="min-w-0 pt-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold group-hover:text-accent">{handicapper.displayName}</p>
              {handicapper.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-accent" />}
              {handicapper.isFeatured && (
                <span className="shrink-0 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                  FEATURED
                </span>
              )}
            </div>
            <p className="truncate text-sm text-muted">@{handicapper.handle}</p>
          </div>
        </div>

      <div className="flex flex-wrap gap-1.5">
        {handicapper.sports.slice(0, 4).map((sport) => (
          <span
            key={sport}
            className="flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted"
          >
            <SportIcon sport={sport} className="h-3.5 w-3.5" />
            {SPORT_LABELS[sport] ?? sport}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 text-sm">
        <div>
          <p className="text-muted">Record</p>
          <p className="font-semibold tabular-nums">{stats.record}</p>
        </div>
        <div>
          <p className="text-muted">Win %</p>
          <p className="font-semibold tabular-nums">{stats.winRate ? `${stats.winRate.toFixed(1)}%` : "—"}</p>
        </div>
        <div>
          <p className="text-muted">Units</p>
          <p className={`font-semibold tabular-nums ${stats.unitsNet >= 0 ? "text-accent" : "text-danger"}`}>
            {stats.unitsNet >= 0 ? "+" : ""}
            {stats.unitsNet.toFixed(1)}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted">{formatCents(handicapper.monthlyPriceCents)}/mo</p>
      </div>
    </Link>
  );
}
