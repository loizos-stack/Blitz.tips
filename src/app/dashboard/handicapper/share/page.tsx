import { redirect } from "next/navigation";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";
import { computeStats } from "@/lib/odds";
import { SPORT_LABELS } from "@/lib/utils";
import { siteUrl } from "@/lib/site";
import { ShareStudio, type SharePick } from "@/components/dashboard/share-studio";

export const dynamic = "force-dynamic";

export default async function HandicapperSharePage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  const stats = computeStats(handicapper.picks);
  const base = siteUrl();

  // Only settled picks can be shared — a pending premium pick is still behind
  // the paywall. Most recent first, capped so the studio stays light.
  const settled: SharePick[] = handicapper.picks
    .filter((p) => p.result !== "PENDING")
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      matchup: p.matchup,
      selection: p.selection,
      result: p.result,
      sportLabel: SPORT_LABELS[p.sport] ?? p.sport,
    }));

  return (
    <ShareStudio
      baseUrl={base}
      handle={handicapper.handle}
      displayName={handicapper.displayName}
      record={stats.record}
      unitsNet={stats.unitsNet}
      roi={stats.roi}
      picks={settled}
    />
  );
}
