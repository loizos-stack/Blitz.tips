import { redirect } from "next/navigation";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";
import { computeStats } from "@/lib/odds";
import { isPickLocked } from "@/lib/pick-visibility";
import { SPORT_LABELS } from "@/lib/utils";
import { siteUrl } from "@/lib/site";
import { ShareStudio, type SharePick } from "@/components/dashboard/share-studio";

export const dynamic = "force-dynamic";

export default async function HandicapperSharePage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  const stats = computeStats(handicapper.picks);
  const base = siteUrl();

  const toSharePick = (p: (typeof handicapper.picks)[number]): SharePick => ({
    id: p.id,
    matchup: p.matchup,
    selection: p.selection,
    result: p.result,
    sportLabel: SPORT_LABELS[p.sport] ?? p.sport,
    // The public card is rendered from an anonymous viewpoint, so a premium pick
    // that hasn't hit its reveal time shares as a locked teaser.
    locked: isPickLocked(p, false),
  });

  const settled = handicapper.picks.filter((p) => p.result !== "PENDING").slice(0, 12).map(toSharePick);
  const pending = handicapper.picks.filter((p) => p.result === "PENDING").slice(0, 12).map(toSharePick);

  return (
    <ShareStudio
      baseUrl={base}
      handle={handicapper.handle}
      displayName={handicapper.displayName}
      record={stats.record}
      unitsNet={stats.unitsNet}
      roi={stats.roi}
      picks={settled}
      pendingPicks={pending}
    />
  );
}
