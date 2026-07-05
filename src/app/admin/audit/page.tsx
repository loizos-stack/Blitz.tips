import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const entries = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[48rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Admin</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Target</th>
            <th className="px-4 py-3">Detail</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted">
                No admin actions logged yet.
              </td>
            </tr>
          ) : (
            entries.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-b-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  {e.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-2.5">{e.actorEmail}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-2.5 text-muted">
                  {e.targetType} · {e.targetId.slice(0, 10)}
                </td>
                <td className="max-w-72 truncate px-4 py-2.5 text-muted">{e.detail ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
