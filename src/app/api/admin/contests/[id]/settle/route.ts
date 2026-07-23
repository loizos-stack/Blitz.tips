import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { computeStandings } from "@/lib/contest";
import { logAdmin } from "@/lib/audit";

// Finalize a contest: compute the ROI standings, write each entry's final rank
// and prize, and flip the contest to SETTLED. Idempotent-ish — re-running just
// recomputes from the current graded picks (useful if a late correction lands
// before payouts go out).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("contests");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      entries: { include: { picks: true, user: { select: { name: true, username: true } } } },
    },
  });
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  const standings = computeStandings(contest.entries, contest);

  await prisma.$transaction([
    // Reset everyone first so a demoted entry doesn't keep a stale rank/prize.
    prisma.contestEntry.updateMany({
      where: { contestId: id },
      data: { finalRank: null, prizeCents: null },
    }),
    ...standings
      .filter((s) => s.rank != null)
      .map((s) =>
        prisma.contestEntry.update({
          where: { id: s.entryId },
          data: { finalRank: s.rank, prizeCents: s.prizeCents },
        })
      ),
    prisma.contest.update({ where: { id }, data: { status: "SETTLED", settledAt: new Date() } }),
  ]);

  const paidWinners = standings.filter((s) => s.prizeCents > 0).length;
  await logAdmin(ctx.session, "contest.settle", "Contest", id, `${paidWinners} winners`);

  return NextResponse.json({ ok: true, winners: paidWinners });
}
