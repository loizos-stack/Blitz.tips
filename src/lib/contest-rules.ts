import { MAX_PICKS_PER_DAY, MAX_PICKS_PER_WEEK, MAX_UNITS_PER_DAY } from "@/lib/contest-limits";

/**
 * The contest rules, in one place.
 *
 * Shown twice — in the modal you must accept before entering, and on the public
 * rules page — and those two must never disagree. Someone who entered under the
 * modal's wording and later reads something different on the page has a real
 * grievance, especially where money is involved. So both render this list.
 *
 * Not server-only: the modal is a client component.
 */

export interface ContestRulesInfo {
  name: string;
  minPicks: number;
  winners: number;
  prizeLabel: string;
  dateRange: string;
  registrationCloses: string;
  dynamicPayouts: boolean;
}

export function contestRuleItems(rules: ContestRulesInfo): string[] {
  return [
    "Free to enter. One entry per person — duplicate or multiple accounts are disqualified.",
    "Open to registered users who are of legal age to participate where they live.",
    `Registration closes ${rules.registrationCloses}. After that no new entries are accepted, and the number of paid places is locked for the rest of the contest.`,
    "Single picks only — parlays are not allowed in the contest.",
    "Every market we price counts: moneylines, spreads and handicaps, totals, alternate lines, 1st half / quarter / period markets, and player props.",
    "All picks are taken from the live Blitz.tips board at the odds shown — you can't enter your own price. If a line moves before you submit, the pick is rejected and you can pick again at the new number.",
    "Picks are graded automatically from the odds feed's final scores, several times a day. Anything the feed can't grade is settled manually by Blitz.tips.",
    `Daily limit: up to ${MAX_PICKS_PER_DAY} picks and ${MAX_UNITS_PER_DAY} total units per day.`,
    `Weekly limit: up to ${MAX_PICKS_PER_WEEK} picks per week. Both quotas reset automatically — daily at midnight UTC, weekly on Monday.`,
    `Anyone who enters can post picks. To be eligible for the leaderboard and the prize pool you must post at least ${rules.minPicks} graded (settled) picks — the prizes reward sustained volume, not a short hot run.`,
    "Entrants are ranked by volume-adjusted ROI: your return on units risked, but a fixed block of break-even units is added in, so your ROI only counts fully once you've posted real volume. A small hot streak can't top a full season — posting consistently all contest long is rewarded over hitting the minimum and stopping.",
    "Every pick must be submitted before the event starts; you can't post on a game already underway or one after the contest ends.",
    "Results are graded by Blitz.tips and are final.",
    rules.dynamicPayouts
      ? `Paid places scale with the field: the top 3 are paid, plus one more place for every 10 entrants who join. The full ${rules.prizeLabel} guaranteed pool is split across those places by ICM, re-calculated as people join and locked when registration closes. Contest runs ${rules.dateRange}.`
      : `The top ${rules.winners} finishers split the ${rules.prizeLabel} guaranteed prize pool. Contest runs ${rules.dateRange}.`,
    "Integrity: we log the IP address and device used for every entry and every pick. Multiple accounts, entries sharing an IP or device, collusion, or any manipulation lead to disqualification and forfeiture of any prize.",
    "Blitz.tips may disqualify any entry, remove an entrant, or adjust the rules to protect the integrity of the contest. All decisions are final.",
  ];
}
