import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ReviewForm } from "@/components/review-form";
import type { ReviewableHandicapper } from "@/lib/reviews";

// The Reviews section of the subscriber dashboard: one card per handicapper the
// user has paid for, each with a star + written review form. If they've never
// subscribed to a paid package they can't review anyone.
export function SubscriberReviews({ handicappers }: { handicappers: ReviewableHandicapper[] }) {
  if (handicappers.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-muted">
          You can&apos;t leave a review yet — you&apos;re not subscribed to any handicapper&apos;s paid
          packages. Subscribe to a handicapper to rate and review them.
        </p>
        <Link
          href="/leaderboard"
          className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
        >
          Browse the leaderboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {handicappers.map((h) => (
        <div key={h.id} className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/handicappers/${h.handle}`}
              className="flex min-w-0 items-center gap-2 hover:text-accent"
            >
              <Avatar
                src={h.avatarUrl}
                name={h.displayName}
                className="h-9 w-9 shrink-0 rounded-full text-xs"
              />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{h.displayName}</span>
                <span className="block truncate text-xs text-muted">@{h.handle}</span>
              </span>
            </Link>
          </div>
          <div className="mt-4">
            <ReviewForm handicapperId={h.id} initial={h.review} />
          </div>
        </div>
      ))}
    </div>
  );
}
