"use client";

import { useState } from "react";

/**
 * The homepage directory grid, with the handicappers who have gone quiet held
 * behind a "Load more" button.
 *
 * Both groups are rendered on the server and arrive with the page; the button
 * only reveals what is already here. That is deliberate — fetching them on
 * click would mean a second round trip, and a route handler, to show cards we
 * had already paid to compute. The directory is a few dozen cards at most, so
 * the payload cost is far smaller than the request cost.
 *
 * `hidden` is a prop rather than a second set of children because the two
 * groups share one grid: revealing appends to the same columns instead of
 * starting a second grid under the button.
 */
export function HandicapperReveal({
  shownCount,
  hiddenCount,
  days,
  hidden,
  empty,
  children,
}: {
  /** How many cards `children` renders — this component cannot count an RSC node. */
  shownCount: number;
  /** How many cards `hidden` renders. Zero hides the button entirely. */
  hiddenCount: number;
  /**
   * The activity window the hidden group fell outside of, for the button's
   * label. Passed in rather than imported: the constant lives beside the split
   * in lib/handicappers, which is server-only.
   */
  days: number;
  hidden: React.ReactNode;
  /** Shown in place of the grid when nothing is active and nothing is revealed yet. */
  empty: React.ReactNode;
  children: React.ReactNode;
}) {
  const [revealed, setRevealed] = useState(false);
  const button = !revealed && (
    <RevealButton count={hiddenCount} days={days} onClick={() => setRevealed(true)} />
  );

  // Every match is dormant and still hidden: an empty grid would read as a
  // broken page, so say why it's empty and leave the button to fix it.
  if (shownCount === 0 && !revealed) {
    return (
      <>
        {empty}
        {button}
      </>
    );
  }

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
        {revealed && hidden}
      </div>
      {button}
    </>
  );
}

function RevealButton({
  count,
  days,
  onClick,
}: {
  count: number;
  days: number;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full rounded-lg border border-border px-4 py-3 text-sm font-semibold hover:border-accent hover:text-accent"
    >
      Load more{" "}
      <span className="font-medium text-muted">
        ({count} {count === 1 ? "handicapper" : "handicappers"} with no picks in {days} days)
      </span>
    </button>
  );
}
