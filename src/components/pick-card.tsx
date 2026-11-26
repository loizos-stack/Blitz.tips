import { Lock, Layers, Clock } from "lucide-react";
import { PlayerTag } from "@/components/player-tag";
import {
  PickDetails,
  PickDetailRow,
  PickHeader,
  PickMatchup,
} from "@/components/pick-details";
import { LocalTime } from "@/components/local-time";
import type { Pick as PickModel, ParlayLeg } from "@prisma/client";
import { ResultPill } from "@/components/result-pill";
import { SportsbookCta } from "@/components/sportsbook-cta";
import type { Sportsbook } from "@/lib/sportsbooks";
import { SportIcon } from "@/components/sport-icon";
import { TeamLogo } from "@/components/team-logo";
import { UnitsRisk } from "@/components/units-risk";
import { getTeamLogoUrl } from "@/lib/team-logos";
import { Odds } from "@/components/odds-format";
import { SPORT_LABELS, BET_TYPE_LABELS, usesVsSeparator, cn } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

// Synchronous ESPN fallback for the away/home crests from a matchup string —
// used when the pick hasn't been enriched server-side (enrichPickCrests adds
// awayTeamLogo/homeTeamLogo, incl. TheSportsDB coverage). Splits on the usual
// separators so both "Away @ Home" and "Home vs Away" resolve.
function matchupCrests(sport: PickSport, matchup: string) {
  const [away, home] = matchup.split(/\s+(?:@|vs\.?|at)\s+/i);
  return {
    awayLogo: getTeamLogoUrl(sport, (away ?? "").trim()),
    homeLogo: getTeamLogoUrl(sport, (home ?? "").trim()),
  };
}

// Optional pre-resolved crests attached by enrichPickCrests (server-side). When
// absent, PickCard falls back to the synchronous ESPN lookup above.
type CrestFields = { awayTeamLogo?: string | null; homeTeamLogo?: string | null };
type LegWithCrests = Pick<ParlayLeg, "id" | "matchup" | "selection" | "odds"> & CrestFields;
type PickWithLegs = PickModel & CrestFields & { parlayLegs?: LegWithCrests[] };

// Overlapping away+home crests, shown before a matchup (parlay legs). Renders
// nothing when neither side resolves.
function CrestPair({
  sport,
  awayLogo,
  homeLogo,
  size = "h-6 w-6",
}: {
  sport: PickSport;
  awayLogo: string | null;
  homeLogo: string | null;
  size?: string;
}) {
  if (!awayLogo && !homeLogo) return null;
  // Match the matchup text order: home crest first for "Home vs Away" sports.
  const [first, second] = usesVsSeparator(sport) ? [homeLogo, awayLogo] : [awayLogo, homeLogo];
  return (
    <span className="flex shrink-0 items-center -space-x-1.5">
      {first && <TeamLogo sport={sport} logoUrl={first} className={`${size} rounded-full ring-2 ring-surface`} />}
      {second && <TeamLogo sport={sport} logoUrl={second} className={`${size} rounded-full ring-2 ring-surface`} />}
    </span>
  );
}

/**
 * "NFL", or "Basketball · EuroLeague".
 *
 * The league is only worth printing when it says something the sport does not.
 * For the US leagues the two strings are identical, and the header read
 * "NFL · NFL".
 */
function sportLine(sport: PickSport, league: string | null): string {
  const label = SPORT_LABELS[sport] ?? sport;
  const extra = league?.trim();
  if (!extra || extra.toLowerCase() === label.toLowerCase()) return label;
  return `${label} · ${extra}`;
}

export function PickCard({
  pick,
  locked = false,
  book = null,
}: {
  pick: PickWithLegs;
  locked?: boolean;
  /** Renders the Stake partner link. Caller must have geo-gated to non-US. */
  book?: Sportsbook | null;
}) {
  const isParlay = pick.betType === "PARLAY";
  const legs = pick.parlayLegs ?? [];
  // Prefer server-enriched crests (covers TheSportsDB); fall back to the
  // synchronous ESPN lookup so an un-enriched pick still shows US-league logos.
  const sync = isParlay ? null : matchupCrests(pick.sport, pick.matchup);
  const awayLogo = pick.awayTeamLogo ?? sync?.awayLogo ?? null;
  const homeLogo = pick.homeTeamLogo ?? sync?.homeLogo ?? null;
  // Order crests to match the matchup text: home crest leads for "Home vs Away"
  // sports (soccer, etc.), away crest leads for "Away @ Home" (US) sports.
  const [startLogo, endLogo] = usesVsSeparator(pick.sport)
    ? [homeLogo, awayLogo]
    : [awayLogo, homeLogo];

  /**
   * The affiliate link sits beside the stake, in the same row as the price and
   * the units — that row is the bet, and the link belongs with it rather than
   * floating underneath.
   *
   * Shown until the pick is graded, not until kickoff. A pick can be live and
   * still worth backing in-play, and a card that silently drops its link the
   * moment a game starts looks broken rather than deliberate. Once there's a
   * result there is nothing left to place, so PENDING is the whole condition.
   */
  const betCta =
    book && pick.result === "PENDING" ? (
      <SportsbookCta
        book={book}
        variant="button"
        sport={pick.sport}
        league={pick.oddsApiSportKey}
        event={pick.oddsApiEventId}
      />
    ) : null;

  if (locked) {
    // Nothing real is drawn here, and nothing real is received: the caller
    // redacts a locked pick before it is passed (redactLockedPick). The bars
    // below are placeholders standing in for text that does not exist on this
    // object, rather than the pick's own words under a blur.
    return (
      <div className={cn("card flex flex-col p-5", pick.isPremium && "card-premium")}>
        <PickHeader
          sportIcon={
            isParlay ? <Layers className="h-4 w-4" /> : <SportIcon sport={pick.sport} className="h-4 w-4" />
          }
          sportLabel={isParlay ? "Parlay" : SPORT_LABELS[pick.sport]}
          time={
            <>
              <Clock className="h-4 w-4" />
              <LocalTime iso={new Date(pick.eventStartsAt).toISOString()} withZone />
            </>
          }
        />
        {/* The overlay covers the redacted body only. Over the whole card it
            also washed out the sport and kickoff, which are the two things a
            teaser is meant to tell a reader.

            The body grows to fill the card (flex-1) and centres what it holds,
            because a locked card sits in a grid row sized by the unlocked cards
            beside it — pinned to the top, the lock floated in the upper third
            of a tall green box and the rest read as a rendering fault. */}
        <div className="relative mt-4 flex flex-1 flex-col justify-center">
          <div aria-hidden className="space-y-3">
            <div className="mx-auto h-5 w-2/3 rounded bg-surface-raised" />
            <div className="h-4 w-1/2 rounded bg-surface-raised" />
            <div className="h-4 w-1/3 rounded bg-surface-raised" />
          </div>
          <div className="absolute inset-0 -m-2 flex items-center justify-center bg-surface/60">
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium">
              <Lock className="h-4 w-4" /> Subscribe to unlock
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("card p-5", pick.isPremium && "card-premium")}>
      <PickHeader
        sportIcon={
          isParlay ? <Layers className="h-4 w-4" /> : <SportIcon sport={pick.sport} className="h-4 w-4" />
        }
        sportLabel={
          isParlay
            ? `${legs.length}-leg parlay`
            : sportLine(pick.sport, pick.league)
        }
        time={
          <>
            <Clock className="h-4 w-4" />
            <LocalTime iso={new Date(pick.eventStartsAt).toISOString()} withZone />
          </>
        }
      />

      {!isParlay && (
        <PickMatchup
          startLogo={
            startLogo ? (
              <TeamLogo sport={pick.sport} logoUrl={startLogo} className="h-6 w-6 shrink-0 rounded-full ring-2 ring-surface" />
            ) : undefined
          }
          endLogo={
            endLogo ? (
              <TeamLogo sport={pick.sport} logoUrl={endLogo} className="h-6 w-6 shrink-0 rounded-full ring-2 ring-surface" />
            ) : undefined
          }
        >
          {pick.matchup}
        </PickMatchup>
      )}

      {/* A prop is about a person, so the person sits under the fixture and
          above the numbers, centred to match it. */}
      {pick.playerName && (
        <div className="mt-4 flex justify-center">
          <PlayerTag
            size="lg"
            playerName={pick.playerName}
            photoUrl={pick.playerPhotoUrl}
            team={pick.playerTeam}
          />
        </div>
      )}

      <PickDetails>
        <PickDetailRow label="Bet Type">{BET_TYPE_LABELS[pick.betType]}</PickDetailRow>
        <PickDetailRow label="Selection">
          {isParlay ? (
            // A parlay's "selection" is its legs, so they are the value of this
            // row rather than a block floating outside the labelled list.
            <ul className="divide-y divide-border rounded-lg border border-border">
              {legs.map((leg) => {
                const legSync = matchupCrests(pick.sport, leg.matchup);
                return (
                  <li key={leg.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <CrestPair
                        sport={pick.sport}
                        awayLogo={leg.awayTeamLogo ?? legSync.awayLogo ?? null}
                        homeLogo={leg.homeTeamLogo ?? legSync.homeLogo ?? null}
                        size="h-5 w-5"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-display font-medium">{leg.selection}</span>
                        <span className="block truncate font-display text-xs text-muted">{leg.matchup}</span>
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted"><Odds value={leg.odds} /></span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="font-display font-semibold">{pick.selection}</span>
          )}
        </PickDetailRow>
        <PickDetailRow label="Odds">
          <span className="font-semibold tabular-nums"><Odds value={pick.odds} /></span>
        </PickDetailRow>
        <PickDetailRow label="Units">
          <UnitsRisk units={pick.units} />
        </PickDetailRow>
        {pick.analysis && (
          // Inside the group, not after it: as its own bordered block it sat
          // against PickDetails' closing rule and drew two lines a few pixels
          // apart.
          <PickDetailRow label="Analysis">
            <span className="whitespace-pre-line text-muted">{pick.analysis}</span>
          </PickDetailRow>
        )}
      </PickDetails>

      {betCta && <div className="mt-4 flex">{betCta}</div>}

      <div className="mt-4 flex items-center justify-between gap-3">
        {/* No grading state here: the pill already says PENDING or the result,
            and printing "Pending" twice side by side said nothing twice. The
            handicapper's own row keeps it, because there it replaces the
            "Gradable after kickoff" line rather than repeating the pill. */}
        <ResultPill result={pick.result} />
        {pick.isPremium ? (
          <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
            Premium
          </span>
        ) : (
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
            Free
          </span>
        )}
      </div>
    </div>
  );
}
