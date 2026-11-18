import "server-only";
import { prisma } from "@/lib/prisma";
import { isPickLocked } from "@/lib/pick-visibility";
import type { PickResult } from "@prisma/client";

export interface TailState {
  tails: number;
  fades: number;
  /** The reader's own position: true tailed, false faded, null none. */
  mine: boolean | null;
  canTail: boolean;
  reason?: string;
}

interface TailablePick {
  id: string;
  isPremium: boolean;
  result: PickResult;
  eventStartsAt: Date;
}

/**
 * Tail/fade state for a set of picks, from one pair of queries rather than two
 * per card — a profile renders dozens of these and a per-card count would be a
 * query storm on the page that matters most.
 *
 * `viewerId` null means signed out: counts still come back (they're public
 * social proof and they're most persuasive to the people not yet signed up),
 * but nothing is tailable.
 *
 * The rules mirror the API exactly. They have to: a button that looks pressable
 * and then 403s is worse than one that explains itself up front.
 */
export async function tailStates(
  picks: TailablePick[],
  viewerId: string | null,
  opts: { isOwner: boolean; unlocked: boolean }
): Promise<Map<string, TailState>> {
  const out = new Map<string, TailState>();
  if (picks.length === 0) return out;

  const pickIds = picks.map((p) => p.id);
  const [grouped, mine] = await Promise.all([
    prisma.pickTail.groupBy({
      by: ["pickId", "tailed"],
      where: { pickId: { in: pickIds } },
      _count: { _all: true },
    }),
    viewerId
      ? prisma.pickTail.findMany({
          where: { pickId: { in: pickIds }, userId: viewerId },
          select: { pickId: true, tailed: true },
        })
      : Promise.resolve([]),
  ]);

  const counts = new Map<string, { tails: number; fades: number }>();
  for (const row of grouped) {
    const entry = counts.get(row.pickId) ?? { tails: 0, fades: 0 };
    if (row.tailed) entry.tails = row._count._all;
    else entry.fades = row._count._all;
    counts.set(row.pickId, entry);
  }
  const mineByPick = new Map(mine.map((m) => [m.pickId, m.tailed]));

  const now = Date.now();
  for (const pick of picks) {
    const c = counts.get(pick.id) ?? { tails: 0, fades: 0 };
    let canTail = true;
    let reason: string | undefined;

    if (!viewerId) {
      canTail = false;
      reason = "Sign in to tail or fade.";
    } else if (opts.isOwner) {
      canTail = false;
      reason = "You can't tail your own pick.";
    } else if (pick.eventStartsAt.getTime() <= now) {
      canTail = false;
      reason = "Tailing closed at kickoff.";
    } else if (isPickLocked(pick, opts.unlocked)) {
      canTail = false;
      reason = "Subscribe to see this pick first.";
    }

    out.set(pick.id, {
      tails: c.tails,
      fades: c.fades,
      mine: mineByPick.get(pick.id) ?? null,
      canTail,
      reason,
    });
  }

  return out;
}
