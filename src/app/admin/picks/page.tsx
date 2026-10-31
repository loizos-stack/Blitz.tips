import { prisma } from "@/lib/prisma";
import { formatOdds } from "@/lib/odds";
import { AdminSelect, AdminButton } from "@/components/admin/admin-actions";
import { PickCorrection } from "@/components/admin/pick-correction";
import { LocalTime } from "@/components/local-time";
import { guardAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const RESULT_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "WIN", label: "Win" },
  { value: "LOSS", label: "Loss" },
  { value: "PUSH", label: "Push" },
  { value: "VOID", label: "Void" },
];

export default async function AdminPicksPage() {
  await guardAdminPage("picks");
  // Newest picks first (by when they were posted) so the latest activity is on top.
  const picks = await prisma.pick.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { handicapper: { select: { handle: true, userId: true } } },
  });

  // Self-graded picks are the integrity risk — label them so they stand out
  // from admin- and score-settled results.
  const settledByLabel = (p: (typeof picks)[number]) =>
    !p.settledBy ? (
      <span className="text-muted">—</span>
    ) : p.settledBy === "auto" ? (
      <span className="text-accent">Auto (score)</span>
    ) : p.settledBy === p.handicapper.userId ? (
      <span className="text-gold">Self</span>
    ) : (
      <span>Admin</span>
    );

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[68rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Capper</th>
            <th className="px-4 py-3">Matchup</th>
            <th className="px-4 py-3">Selection</th>
            <th className="px-4 py-3">Odds</th>
            <th className="px-4 py-3">Units</th>
            <th className="px-4 py-3">Posted</th>
            <th className="px-4 py-3">Event</th>
            <th className="px-4 py-3">Result</th>
            <th className="px-4 py-3">Settled by</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {picks.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-2.5 font-medium">@{p.handicapper.handle}</td>
              <td className="max-w-44 truncate px-4 py-2.5 font-display">{p.matchup}</td>
              <td className="max-w-44 truncate px-4 py-2.5 font-display text-muted">{p.selection}</td>
              <td className="px-4 py-2.5 tabular-nums">{formatOdds(p.odds)}</td>
              <td className="px-4 py-2.5 tabular-nums">{p.units}u</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                <LocalTime iso={p.createdAt.toISOString()} />
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                <LocalTime iso={p.eventStartsAt.toISOString()} />
              </td>
              <td className="px-4 py-2.5">
                <AdminSelect
                  endpoint={`/api/admin/picks/${p.id}`}
                  field="result"
                  value={p.result}
                  options={RESULT_OPTIONS}
                />
              </td>
              <td className="px-4 py-2.5 text-xs">{settledByLabel(p)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                <div className="flex justify-end gap-1.5">
                  <PickCorrection
                    id={p.id}
                    matchup={p.matchup}
                    selection={p.selection}
                    playerName={p.playerName}
                    linePoint={p.linePoint}
                  />
                  <AdminButton
                    endpoint={`/api/admin/picks/${p.id}`}
                    method="DELETE"
                    label="Delete"
                    tone="danger"
                    confirmText="Delete this pick from the record? This cannot be undone."
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
