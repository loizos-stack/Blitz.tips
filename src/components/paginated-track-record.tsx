"use client";

import { useState } from "react";
import { PickCard } from "@/components/pick-card";
import { isPickLocked } from "@/lib/pick-visibility";

type CardPick = React.ComponentProps<typeof PickCard>["pick"];

// Track record with client-side "Load more" pagination — shows `pageSize` picks
// at a time so a long history doesn't render (or scroll) all at once.
export function PaginatedTrackRecord({
  picks,
  unlocked,
  pageSize = 6,
}: {
  picks: CardPick[];
  unlocked: boolean;
  pageSize?: number;
}) {
  const [count, setCount] = useState(pageSize);
  const visible = picks.slice(0, count);
  const remaining = picks.length - count;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((pick) => (
          <PickCard key={pick.id} pick={pick} locked={isPickLocked(pick, unlocked)} />
        ))}
      </div>
      {remaining > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setCount((c) => c + pageSize)}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            Load more ({remaining} more)
          </button>
        </div>
      )}
    </>
  );
}
