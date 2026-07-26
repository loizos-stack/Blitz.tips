import { TeamLogo } from "@/components/team-logo";
import { usesVsSeparator } from "@/lib/utils";
import { matchupCrests } from "@/lib/team-logos";
import { cn } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

/**
 * A matchup with a crest on each side: [away] Away @ Home [home].
 *
 * Crest order follows the matchup text — the home crest leads for "Home vs
 * Away" sports (soccer), the away crest for "Away @ Home" (US sports) — so the
 * badges always sit next to the team they belong to.
 *
 * Logos can be passed in when the caller already has them (the odds feed
 * supplies them per event); otherwise they're looked up from the matchup
 * string. Either side may resolve to null, in which case TeamLogo falls back to
 * the sport icon.
 */
export function MatchupTeams({
  sport,
  matchup,
  awayLogo,
  homeLogo,
  className,
  logoClassName = "h-5 w-5",
  textClassName = "font-display font-semibold",
}: {
  sport: PickSport;
  matchup: string;
  awayLogo?: string | null;
  homeLogo?: string | null;
  className?: string;
  logoClassName?: string;
  textClassName?: string;
}) {
  const fallback = matchupCrests(sport, matchup);
  const away = awayLogo ?? fallback.awayLogo;
  const home = homeLogo ?? fallback.homeLogo;
  const [startLogo, endLogo] = usesVsSeparator(sport) ? [home, away] : [away, home];

  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <TeamLogo
        sport={sport}
        logoUrl={startLogo}
        className={cn("shrink-0 rounded-full ring-2 ring-surface", logoClassName)}
      />
      <span className={cn("truncate", textClassName)}>{matchup}</span>
      <TeamLogo
        sport={sport}
        logoUrl={endLogo}
        className={cn("shrink-0 rounded-full ring-2 ring-surface", logoClassName)}
      />
    </span>
  );
}
