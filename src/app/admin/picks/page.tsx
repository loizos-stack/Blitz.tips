import { prisma } from "@/lib/prisma";
import { formatOdds } from "@/lib/odds";
import { AdminSelect, AdminButton } from "@/components/admin/admin-actions";
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
  const picks = await prisma.pick.findMany({
    orderBy: { eventStartsAt: "desc" },
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
      <table className="w-full min-w-[64rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Capper</th>
            <th className="px-4 py-3">Matchup</th>
            <th className="px-4 py-3">Selection</th>
            <th className="px-4 py-3">Odds</th>
            <th className="px-4 py-3">Units</th>
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
              <td className="max-w-52 truncate px-4 py-2.5 font-display">{p.matchup}</td>
              <td className="max-w-48 truncate px-4 py-2.5 font-display text-muted">{p.selection}</td>
              <td className="px-4 py-2.5 tabular-nums">{formatOdds(p.odds)}</td>
              <td className="px-4 py-2.5 tabular-nums">{p.units}u</td>
              <td className="px-4 py-2.5 text-muted">{p.eventStartsAt.toLocaleDateString()}</td>
              <td className="px-4 py-2.5">
                <AdminSelect
                  endpoint={`/api/admin/picks/${p.id}`}
                  field="result"
                  value={p.result}
                  options={RESULT_OPTIONS}
                />
              </td>
              <td className="px-4 py-2.5 text-xs">{settledByLabel(p)}</td>
              <td className="px-4 py-2.5 text-right">
                <AdminButton
                  endpoint={`/api/admin/picks/${p.id}`}
                  method="DELETE"
                  label="Delete"
                  tone="danger"
                  confirmText="Delete this pick from the record? This cannot be undone."
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
