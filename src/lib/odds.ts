import type { Pick as PickModel } from "@prisma/client";

/** Profit/loss in units for a single settled pick, based on American odds. */
export function unitProfit(odds: number, units: number, result: PickModel["result"]): number {
  switch (result) {
    case "WIN":
      return odds > 0 ? units * (odds / 100) : units * (100 / Math.abs(odds));
    case "LOSS":
      return -units;
    case "PUSH":
    case "VOID":
    case "PENDING":
    default:
      return 0;
  }
}

export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/** American odds → decimal (payout multiplier including stake). */
export function americanToDecimal(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

/** Decimal odds → American, rounded to a whole number. */
export function decimalToAmerican(dec: number): number {
  if (dec <= 1) return 0;
  return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
}

/** Combine parlay legs' American odds by multiplying their decimal payouts. */
export function combineParlayOdds(legOdds: number[]): number {
  if (legOdds.length === 0) return 0;
  const dec = legOdds.reduce((acc, o) => acc * americanToDecimal(o), 1);
  return decimalToAmerican(dec);
}

export interface HandicapperStats {
  totalPicks: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  winRate: number | null;
  unitsNet: number;
  unitsRisked: number;
  roi: number | null;
  record: string;
}

export function computeStats(picks: Pick<PickModel, "odds" | "units" | "result">[]): HandicapperStats {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let pending = 0;
  let unitsNet = 0;
  let unitsRisked = 0;

  for (const pick of picks) {
    switch (pick.result) {
      case "WIN":
        wins += 1;
        unitsRisked += pick.units;
        break;
      case "LOSS":
        losses += 1;
        unitsRisked += pick.units;
        break;
      case "PUSH":
        pushes += 1;
        break;
      case "VOID":
        break;
      case "PENDING":
      default:
        pending += 1;
        break;
    }
    unitsNet += unitProfit(pick.odds, pick.units, pick.result);
  }

  const decided = wins + losses;

  return {
    totalPicks: picks.length,
    wins,
    losses,
    pushes,
    pending,
    winRate: decided > 0 ? (wins / decided) * 100 : null,
    unitsNet: round2(unitsNet),
    unitsRisked: round2(unitsRisked),
    roi: unitsRisked > 0 ? round2((unitsNet / unitsRisked) * 100) : null,
    record: `${wins}-${losses}${pushes > 0 ? `-${pushes}` : ""}`,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
