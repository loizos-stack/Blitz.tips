import { prisma } from "@/lib/prisma";
import { AdminButton } from "@/components/admin/admin-actions";
import { guardAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Review-and-remove gallery for user-uploaded profile images.
export default async function AdminMediaPage() {
  await guardAdminPage("media");
  const handicappers = await prisma.handicapperProfile.findMany({
    where: { OR: [{ avatarUrl: { not: null } }, { coverUrl: { not: null } }] },
    orderBy: { updatedAt: "desc" },
    select: { id: true, handle: true, avatarUrl: true, coverUrl: true },
  });

  const items = handicappers.flatMap((h) => [
    ...(h.avatarUrl ? [{ h, kind: "avatar" as const, url: h.avatarUrl }] : []),
    ...(h.coverUrl ? [{ h, kind: "cover" as const, url: h.coverUrl }] : []),
  ]);

  if (items.length === 0) {
    return <div className="card p-8 text-center text-muted">No uploaded images yet.</div>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ h, kind, url }) => (
        <div key={`${h.id}-${kind}`} className="card overflow-hidden p-0">
          <div className={kind === "avatar" ? "flex justify-center bg-surface-raised p-4" : "bg-surface-raised"}>
            {/* eslint-disable-next-line @next/next/no-img-element -- reviewing user uploads */}
            <img
              src={url}
              alt=""
              className={kind === "avatar" ? "h-24 w-24 rounded-full object-cover" : "h-32 w-full object-cover"}
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">@{h.handle}</p>
              <p className="text-xs text-muted">{kind === "avatar" ? "Profile photo" : "Cover image"}</p>
            </div>
            <AdminButton
              endpoint={`/api/admin/handicappers/${h.id}`}
              body={kind === "avatar" ? { removeAvatar: true } : { removeCover: true }}
              label="Remove"
              tone="danger"
              confirmText={`Remove @${h.handle}'s ${kind === "avatar" ? "profile photo" : "cover image"}?`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
