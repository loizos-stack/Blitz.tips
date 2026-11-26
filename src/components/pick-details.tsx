import type { ReactNode } from "react";

/**
 * The labelled half of a pick card: Bet Type, Selection, Odds, Units, Analysis.
 *
 * One component used by both the public card and the handicapper's own row,
 * because those two have drifted before — the player headshot shipped to one
 * and not the other, so a capper looking at their own dashboard saw a feature
 * that appeared to do nothing. Anything that belongs on "the pick card" belongs
 * here, once.
 *
 * Labels rather than a row of chips. A chip row reads fine when you already
 * know what the numbers mean: -109 is the price, 3u is the stake. To anyone
 * who does not, it is four values and no key. Naming them costs a column and
 * removes the guessing.
 *
 * The label column is fixed so the values line up down the card. Without that
 * the colons stagger with the length of each word and the whole block looks
 * accidental.
 */
export function PickDetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5">
      <span className="w-[5.5rem] shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-sm">{children}</span>
    </div>
  );
}

export function PickDetails({ children }: { children: ReactNode }) {
  return <div className="mt-4 divide-y divide-border border-y border-border">{children}</div>;
}

/**
 * Whether the result is settled, said plainly.
 *
 * Sits beside the result pill rather than replacing it: the pill is the
 * OUTCOME (win, loss, push) and this is the STATE (is that outcome final yet).
 * A pending pick shows "Pending" in both places, which looks like a repetition
 * and is not one — the second is what tells a reader the first can still
 * change.
 */
export function GradingState({ settled }: { settled: boolean }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
      {settled ? "Final" : "Pending"}
    </span>
  );
}

/**
 * The card's top line: which sport on the left, when it starts on the right.
 *
 * Both sides carry an icon because at a glance the two read as the same kind
 * of thing — small grey text in opposite corners — and the icons are what
 * separate "what this is" from "when this is".
 */
export function PickHeader({
  sportIcon,
  sportLabel,
  time,
}: {
  sportIcon: ReactNode;
  sportLabel: string;
  time: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted">
      <span className="flex min-w-0 items-center gap-1.5">
        {sportIcon}
        <span className="truncate font-medium">{sportLabel}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">{time}</span>
    </div>
  );
}

/**
 * The fixture, centred, with a crest either side.
 *
 * Centred because it is the card's title — the thing every pick has, whatever
 * kind of bet it is. Left-aligned it sat in a row of other left-aligned rows
 * and read as one more detail rather than the subject.
 */
export function PickMatchup({
  startLogo,
  endLogo,
  children,
}: {
  startLogo?: ReactNode;
  endLogo?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-center">
      {startLogo}
      <p className="font-display text-base font-semibold">{children}</p>
      {endLogo}
    </div>
  );
}
