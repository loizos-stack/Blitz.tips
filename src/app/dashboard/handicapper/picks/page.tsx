import { redirect } from "next/navigation";
import { PostTipForms } from "@/components/post-tip-forms";
import { HandicapperPickList } from "@/components/handicapper-pick-list";
import { enrichPickCrests } from "@/lib/pick-logos";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function HandicapperPicksPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  const displayPicks = await enrichPickCrests(handicapper.picks);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">Post a tip</h2>
        <PostTipForms handicapperSports={handicapper.sports} />
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Your tips</h2>
        {displayPicks.length === 0 ? (
          <p className="text-muted">You haven&apos;t posted any tips yet.</p>
        ) : (
          <HandicapperPickList
            picks={displayPicks}
            share={{ baseUrl: siteUrl(), handle: handicapper.handle, displayName: handicapper.displayName }}
          />
        )}
      </div>
    </div>
  );
}
