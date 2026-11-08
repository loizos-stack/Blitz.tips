import { Download, Film, Info } from "lucide-react";
import { guardAdminPage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { splitRecapKey, yesterday } from "@/lib/recap";
import { RECAP_WORKFLOW, recapDispatchConfig } from "@/lib/recap-dispatch";
import { getConnectedAccount, tiktokConfigured } from "@/lib/tiktok";
import { SendToTikTok, TikTokConnection } from "@/components/admin/tiktok-connection";
import { RecapBuilder, type RecapCandidate } from "@/components/admin/recap-builder";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** "+2.40u" / "−1.66u", with the real minus sign. */
function units(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}u`;
}

/** A stored key as a person reads it: the period, then who it covers. */
function describeKey(key: string): { period: string; handles: string[] } {
  const { period, handles } = splitRecapKey(key);
  const span = period.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  return { period: span ? `${span[1]} → ${span[2]}` : period, handles };
}

export default async function AdminRecapsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  await guardAdminPage("recaps");

  const [videos, settledBy, tiktok, params] = await Promise.all([
    prisma.recapVideo.findMany({ orderBy: { date: "desc" }, take: 30 }),
    // Who there is anything to make a recap of, busiest first. Handicappers
    // with nothing settled are left out rather than offered and then refused.
    prisma.pick.groupBy({
      by: ["handicapperId"],
      where: { result: { in: ["WIN", "LOSS", "PUSH"] }, settledAt: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 100,
    }),
    getConnectedAccount(),
    searchParams,
  ]);

  const profiles = await prisma.handicapperProfile.findMany({
    where: { id: { in: settledBy.map((s) => s.handicapperId) } },
    select: { id: true, handle: true, displayName: true },
  });
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const candidates: RecapCandidate[] = settledBy.flatMap((s) => {
    const p = byId.get(s.handicapperId);
    return p
      ? [{ handle: p.handle, displayName: p.displayName, settled: s._count._all }]
      : [];
  });

  const dispatch = recapDispatchConfig();
  const actionsUrl = dispatch.ready
    ? `https://github.com/${dispatch.owner}/${dispatch.repo}/actions/workflows/${RECAP_WORKFLOW}`
    : `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER ?? "loizos-stack"}/${process.env.VERCEL_GIT_REPO_SLUG ?? "Blitz.tips"}/actions/workflows/${RECAP_WORKFLOW}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Results recaps</h1>
        <p className="mt-1 text-sm text-muted">
          A 9-second 1080×1920 video of a day&apos;s settled picks, made when you ask for one.
          Download and post to TikTok, Reels or Shorts.
        </p>
      </div>

      <RecapBuilder
        candidates={candidates}
        defaultDate={yesterday()}
        setupNeeded={dispatch.ready ? null : dispatch.missing}
        actionsUrl={actionsUrl}
      />

      <TikTokConnection
        configured={tiktokConfigured()}
        error={params.error}
        account={
          tiktok && {
            openId: tiktok.openId,
            displayName: tiktok.displayName,
            scopes: tiktok.scopes,
            connectedAt: tiktok.connectedAt.toISOString(),
          }
        }
      />

      {videos.length === 0 ? (
        <div className="card p-8 text-center">
          <Film className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 font-medium">No recaps yet</p>
          <p className="mt-1 text-sm text-muted">
            Use &ldquo;Create a recap&rdquo; above and the first one appears here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {videos.map((v) => (
            <div key={v.id} className="card overflow-hidden">
              {/* Muted and preload=none: a grid of autoplaying videos would
                  pull tens of megabytes for a page that exists to find one. */}
              <video
                src={v.url}
                controls
                muted
                preload="none"
                className="aspect-[9/16] w-full bg-black"
              />
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{describeKey(v.date).period}</p>
                  {describeKey(v.date).handles.length > 0 && (
                    <p className="truncate text-xs text-accent">
                      {describeKey(v.date)
                        .handles.map((h) => `@${h}`)
                        .join(", ")}
                    </p>
                  )}
                  <p className="mt-0.5 text-sm text-muted">
                    {v.record} ·{" "}
                    <span
                      className={cn(
                        "font-medium",
                        v.units > 0 ? "text-accent" : v.units < 0 ? "text-danger" : "text-muted"
                      )}
                    >
                      {units(v.units)}
                    </span>{" "}
                    · {v.settled} settled
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <a
                    href={v.url}
                    download={`blitz-recap-${v.date}.mp4`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent hover:text-accent"
                  >
                    <Download className="h-3.5 w-3.5" /> Save
                  </a>
                  <SendToTikTok
                    date={v.date}
                    connected={tiktok !== null}
                    sent={Boolean(v.tiktokSentAt)}
                    failed={v.tiktokError}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Each video shows the day&apos;s six biggest movers, win or lose, under a total computed
        from every settled pick — so the headline figure always describes the whole card, not the
        rows on screen. Days that lost money render red and say so.
      </p>
    </div>
  );
}
