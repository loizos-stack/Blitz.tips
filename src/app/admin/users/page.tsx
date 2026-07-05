import { prisma } from "@/lib/prisma";
import { AdminSelect, AdminButton } from "@/components/admin/admin-actions";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = [
  { value: "SUBSCRIBER", label: "Subscriber" },
  { value: "HANDICAPPER", label: "Handicapper" },
  { value: "ADMIN", label: "Admin" },
];

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      handicapper: { select: { handle: true } },
      _count: { select: { subscriptions: true } },
    },
  });

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Handle</th>
            <th className="px-4 py-3">Subs</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Email verified</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-2.5">{u.email}</td>
              <td className="px-4 py-2.5">{u.name ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted">
                {u.handicapper ? `@${u.handicapper.handle}` : "—"}
              </td>
              <td className="px-4 py-2.5 tabular-nums">{u._count.subscriptions}</td>
              <td className="px-4 py-2.5 text-muted">{u.createdAt.toLocaleDateString()}</td>
              <td className="px-4 py-2.5">
                <AdminSelect
                  endpoint={`/api/admin/users/${u.id}`}
                  field="role"
                  value={u.role}
                  options={ROLE_OPTIONS}
                />
              </td>
              <td className="px-4 py-2.5">
                {u.emailVerified ? (
                  <span className="text-accent">✓</span>
                ) : (
                  <AdminButton
                    endpoint={`/api/admin/users/${u.id}`}
                    body={{ emailVerified: true }}
                    label="Mark verified"
                  />
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <AdminButton
                  endpoint={`/api/admin/users/${u.id}`}
                  method="DELETE"
                  label="Delete"
                  tone="danger"
                  confirmText={`Delete ${u.email} and everything they own (profile, picks, subscriptions)? This cannot be undone.`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
