import { redirect } from "next/navigation";
import { breakdownBy } from "@/lib/analytics";
import { SPORT_LABELS, BET_TYPE_LABELS } from "@/lib/utils";
import { BreakdownTable } from "@/components/dashboard/breakdown-table";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperBreakdownsPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  const bySport = breakdownBy(
    handicapper.picks,
    (p) => p.sport,
    (k) => SPORT_LABELS[k] ?? k
  );
  const byBetType = breakdownBy(
    handicapper.picks,
    (p) => p.betType,
    (k) => BET_TYPE_LABELS[k] ?? k
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-0">
        <p className="px-5 pt-5 font-semibold">By sport</p>
        <div className="mt-3">
          <BreakdownTable rows={bySport} firstColumn="Sport" />
        </div>
      </div>
      <div className="card p-0">
        <p className="px-5 pt-5 font-semibold">By bet type</p>
        <div className="mt-3">
          <BreakdownTable rows={byBetType} firstColumn="Bet type" />
        </div>
      </div>
    </div>
  );
}
