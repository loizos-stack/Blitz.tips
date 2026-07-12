import { redirect } from "next/navigation";
import { PostTipForms } from "@/components/post-tip-forms";
import { HandicapperPickList } from "@/components/handicapper-pick-list";
import { enrichPickCrests } from "@/lib/pick-logos";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperPicksPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  const displayPicks = await enrichPickCrests(handicapper.picks);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">Post a tip</h2>
        <PostTipForms handicapperSports={handicapper.sports} />
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Your picks</h2>
        {displayPicks.length === 0 ? (
          <p className="text-muted">You haven&apos;t posted any picks yet.</p>
        ) : (
          <HandicapperPickList picks={displayPicks} />
        )}
      </div>
    </div>
  );
}
