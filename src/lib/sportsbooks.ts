import "server-only";
import { visitorCountry } from "@/lib/geo";
import { isOneWinCountry } from "@/lib/onewin";
import { STAKE_ALL_REGIONS } from "@/lib/stake";

/**
 * Which sportsbook — if any — this visitor is shown.
 *
 * One resolver rather than each book gating itself. Two independent gates can
 * disagree: overlap shows a visitor both books competing in the same slot, and
 * a gap shows them neither with nothing to explain why. A single function that
 * returns exactly one answer makes both impossible.
 *
 * The order is deliberate. 1win's country list is the specific rule and is
 * checked first; Stake is the fallback for everywhere else it's allowed.
 *
 * Fails closed. When the edge can't place someone — local dev, an unusual proxy
 * config, a VPN — they see no book at all. Showing an offshore book to someone
 * whose jurisdiction we don't know is the expensive mistake; showing nothing is
 * a missed click. Same reasoning as lib/geo's isOutsideUs.
 */
export type Sportsbook = "onewin" | "stake";

export async function sportsbookForVisitor(): Promise<Sportsbook | null> {
  const country = await visitorCountry();

  // Unplaceable → nothing. Explicit rather than falling through to the Stake
  // branch, which would otherwise be reached via STAKE_ALL_REGIONS.
  if (country === null) return STAKE_ALL_REGIONS ? "stake" : null;

  if (isOneWinCountry(country)) return "onewin";

  // The US is not on 1win's list and Stake doesn't accept US customers, so a US
  // visitor sees no sportsbook at all.
  if (country === "US") return STAKE_ALL_REGIONS ? "stake" : null;

  return "stake";
}
