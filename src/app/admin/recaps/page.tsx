import { Download, Film, Info } from "lucide-react";
import { guardAdminPage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recapFor, yesterday } from "@/lib/recap";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** "+2.40u" / "−1.66u", with the real minus sign. */
function units(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}u`;
}

export default async function AdminRecapsPage() {
  await guardAdminPage("recaps");

  const [videos, pending] = await Promise.all([
    prisma.recapVideo.findMany({ orderBy: { date: "desc" }, take: 30 }),
    // What tonight's run would produce, so a day with nothing settled is
    // visible as such rather than looking like the job failed.
    recapFor(yesterday()),
  ]);

  const haveYesterday = videos.some((v) => v.date === pending.date);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Results recaps</h1>
        <p className="mt-1 text-sm text-muted">
          A 9-second 1080×1920 video of each day&apos;s settled picks, rendered overnight. Download
          and post to TikTok, Reels or Shorts.
        </p>
      </div>

      {!haveYesterday && (
        <div className="card p-5">
          <h2 className="font-semibold">{pending.label}</h2>
          {pending.totals.settled === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Nothing settled yet, so there is no video for this day. The job skips quiet days
              rather than publishing an empty card.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {pending.totals.settled} settled ({pending.totals.record}, {units(pending.totals.units)}
              ) — not rendered yet. The nightly run is at 09:20 UTC; you can also start it from the
              repository&apos;s Actions tab (&ldquo;Results recap video&rdquo;).
            </p>
          )}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="card p-8 text-center">
          <Film className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 font-medium">No recaps yet</p>
          <p className="mt-1 text-sm text-muted">
            The first one appears after the nightly job runs on a day with settled picks.
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
                  <p className="truncate font-semibold">{v.date}</p>
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
                <a
                  href={v.url}
                  download={`blitz-recap-${v.date}.mp4`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent hover:text-accent"
                >
                  <Download className="h-3.5 w-3.5" /> Save
                </a>
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
