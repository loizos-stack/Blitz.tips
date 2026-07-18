"use client";

import { useState } from "react";
import { HandicapperPickRow } from "@/components/handicapper-pick-row";

type RowPick = React.ComponentProps<typeof HandicapperPickRow>["pick"];

// The handicapper's own picks, split into pending (shown first, in full) and
// graded (paginated with "Load more" so a long history stays manageable).
export function HandicapperPickList({
  picks,
  pageSize = 6,
  share,
}: {
  picks: RowPick[];
  pageSize?: number;
  share?: { baseUrl: string; handle: string; displayName: string };
}) {
  const pending = picks.filter((p) => p.result === "PENDING");
  const graded = picks.filter((p) => p.result !== "PENDING");
  const [count, setCount] = useState(pageSize);
  const remaining = graded.length - count;

  return (
    <div className="flex flex-col gap-5">
      {pending.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Pending ({pending.length})
          </h3>
          <div className="grid gap-3">
            {pending.map((pick) => (
              <HandicapperPickRow key={pick.id} pick={pick} share={share} />
            ))}
          </div>
        </div>
      )}

      {graded.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Graded ({graded.length})
          </h3>
          <div className="grid gap-3">
            {graded.slice(0, count).map((pick) => (
              <HandicapperPickRow key={pick.id} pick={pick} share={share} />
            ))}
          </div>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setCount((c) => c + pageSize)}
              className="mt-3 w-full rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
            >
              Load more ({remaining} more)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
