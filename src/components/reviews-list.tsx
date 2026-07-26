import { Avatar } from "@/components/avatar";
import { Stars } from "@/components/stars";

export interface ReviewItem {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Display-only list of approved reviews shown on the public profile. Writing a
// review happens in the subscriber dashboard, not here.
export function ReviewsList({
  displayName,
  average,
  count,
  reviews,
}: {
  displayName: string;
  average: number | null;
  count: number;
  reviews: ReviewItem[];
}) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">Reviews</h2>
        {average !== null ? (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Stars value={average} />
            <span className="font-semibold text-foreground">{average.toFixed(1)}</span>
            <span>
              ({count} review{count === 1 ? "" : "s"})
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted">No reviews yet</span>
        )}
      </div>

      {reviews.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {reviews.map((r) => (
            <figure key={r.id} className="card p-5">
              <div className="flex items-center gap-3">
                <Avatar src={r.authorAvatarUrl} name={r.authorName} className="h-9 w-9 rounded-full text-xs" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.authorName}</p>
                  <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3">
                <Stars value={r.rating} />
              </div>
              {r.body && <blockquote className="mt-2 text-sm text-muted">{r.body}</blockquote>}
            </figure>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          No reviews yet. Only paid subscribers of {displayName} can leave one, from their dashboard.
        </p>
      )}
    </>
  );
}
