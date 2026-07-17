import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { SocialsForm } from "@/components/socials-form";
import { Avatar } from "@/components/avatar";
import { Stars } from "@/components/stars";
import { summarizeRatings } from "@/lib/reviews";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperCommunityPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  const summary = summarizeRatings(handicapper.reviews.map((r) => r.rating));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SocialsForm
        initial={{
          xUrl: handicapper.xUrl,
          instagramUrl: handicapper.instagramUrl,
          youtubeUrl: handicapper.youtubeUrl,
          tiktokUrl: handicapper.tiktokUrl,
          discordUrl: handicapper.discordUrl,
          telegramUrl: handicapper.telegramUrl,
          websiteUrl: handicapper.websiteUrl,
        }}
      />

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-semibold">
            <Star className="h-4 w-4 text-gold" /> Reviews
          </p>
          {summary.average !== null && (
            <span className="flex items-center gap-2 text-sm">
              <Stars value={summary.average} />
              <span className="font-semibold">{summary.average.toFixed(1)}</span>
              <span className="text-muted">
                ({summary.count} review{summary.count === 1 ? "" : "s"})
              </span>
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          Star ratings and written reviews left by your paid subscribers. These are read-only — only
          subscribers can post them, and they appear on your public profile.
        </p>

        {handicapper.reviews.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No reviews yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {handicapper.reviews.map((r) => {
              const name = r.author.name || r.author.username || "Subscriber";
              return (
                <li key={r.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Avatar src={r.author.image} name={name} className="h-7 w-7 rounded-full text-[10px]" />
                    <span className="text-sm font-medium">{name}</span>
                    <span className="ml-auto">
                      <Stars value={r.rating} />
                    </span>
                  </div>
                  {r.body && <p className="mt-2 text-sm text-muted">{r.body}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
