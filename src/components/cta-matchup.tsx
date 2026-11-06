import { TeamLogo } from "@/components/team-logo";
import type { PickSport } from "@prisma/client";

/**
 * The two crests in a sportsbook CTA — "Bet on [crest] vs [crest] at [book]".
 *
 * Shared by both books so a visitor who gets 1win sees the same button a
 * visitor who gets Stake does.
 *
 * The sides arrive already ordered by the caller rather than as home/away,
 * because the board's order is per sport — soccer lists the home side first,
 * everything else is away-at-home — and that rule belongs with the card, not
 * duplicated here.
 */
export interface CtaSide {
  name: string;
  logo: string | null;
}

export interface CtaMatchup {
  sport: PickSport;
  sides: [CtaSide, CtaSide];
}

/** "Golden State Valkyries vs Atlanta Dream" — for the link's accessible name. */
export function matchupLabel(m: CtaMatchup): string {
  return `${m.sides[0].name} vs ${m.sides[1].name}`;
}

/**
 * Crests only, no names: the button is small and two full club names would
 * wrap it onto three lines. The names are not lost — the whole link carries an
 * aria-label naming both teams and the book, so a screen reader hears
 * "Bet on Golden State Valkyries vs Atlanta Dream at Stake.com" rather than
 * "Bet on at", which is what logos alone would leave it with.
 */
export function CtaMatchupLogos({ matchup }: { matchup: CtaMatchup }) {
  const [first, second] = matchup.sides;
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <TeamLogo sport={matchup.sport} logoUrl={first.logo} className="h-5 w-5 shrink-0" />
      <span className="text-muted">vs</span>
      <TeamLogo sport={matchup.sport} logoUrl={second.logo} className="h-5 w-5 shrink-0" />
    </span>
  );
}
