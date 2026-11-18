import { guardAdminPage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PrizeMonths, type PrizeMonthRow } from "@/components/admin/prize-months";
import { MonthlyPrizeBoard } from "@/components/monthly-prize-board";
import {
  MIN_SETTLED_PICKS,
  PRIZE_CENTS,
  PRIZE_POOL_CENTS,
  PRIZES_START_MONTH,
  isPrizeMonth,
  monthLabel,
  monthWindow,
  monthlyStandings,
  previousMonth,
  prizeMonth,
} from "@/lib/monthly-prizes";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Every prize month from the start up to and including the current one, newest first. */
function monthsSoFar(now: Date): string[] {
  const out: string[] = [];
  let m = prizeMonth(now);
  while (m >= PRIZES_START_MONTH) {
    out.push(m);
    m = previousMonth(m);
  }
  return out;
}

export default async function AdminPrizesPage() {
  await guardAdminPage("prizes");

  const now = new Date();
  const current = prizeMonth(now);
  const months = monthsSoFar(now);

  const [awards, liveStandings] = await Promise.all([
    prisma.monthlyPrizeAward.findMany({
      orderBy: [{ month: "desc" }, { rank: "asc" }],
      include: { handicapper: { select: { handle: true, displayName: true } } },
    }),
    isPrizeMonth(current) ? monthlyStandings(current) : Promise.resolve([]),
  ]);

  const rows: PrizeMonthRow[] = months.map((month) => ({
    month,
    label: monthLabel(month),
    closed: now.getTime() >= monthWindow(month).end.getTime(),
    awards: awards
      .filter((a) => a.month === month)
      .map((a) => ({
        id: a.id,
        rank: a.rank,
        handle: a.handicapper.handle,
        displayName: a.handicapper.displayName,
        prizeCents: a.prizeCents,
        unitsNet: a.unitsNet,
        record: a.record,
        paidAt: a.paidAt?.toISOString() ?? null,
      })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Monthly prizes</h1>
        <p className="mt-1 text-sm text-muted">
          {formatCents(PRIZE_POOL_CENTS)} a month — {formatCents(PRIZE_CENTS[0])},{" "}
          {formatCents(PRIZE_CENTS[1])}, {formatCents(PRIZE_CENTS[2])} — to the handicappers with
          the best net units from picks settled that month. Minimum {MIN_SETTLED_PICKS} settled
          picks to qualify. Running since {monthLabel(PRIZES_START_MONTH)}.
        </p>
      </div>

      {months.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          The prize starts in {monthLabel(PRIZES_START_MONTH)}. Nothing to record yet.
        </div>
      ) : (
        <>
          {/* The same board the public sees, so there is no second source of
              truth to disagree with when someone queries a placing. */}
          <MonthlyPrizeBoard month={current} standings={liveStandings} />
          <PrizeMonths months={rows} />
        </>
      )}
    </div>
  );
}
