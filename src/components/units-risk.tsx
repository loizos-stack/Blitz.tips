/**
 * The stake, as a chip.
 *
 * Shared by the public pick card and the handicapper's own row, which is the
 * point: the public card used to carry its own copy of this markup at
 * `text-base`, so the stake was printed a size larger than the Odds and
 * Selection it sits under and read as the loudest thing on the card. Two copies
 * of one chip in two files is exactly how that happens.
 *
 * `text-sm` is set here rather than inherited so the number matches the rows
 * around it — PickDetailRow's values are `text-sm` — wherever the chip is used.
 */
export function UnitsRisk({ units }: { units: number }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-0.5">
      <span className="text-sm font-bold tabular-nums text-accent">{units}u</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-accent/80">risk</span>
    </span>
  );
}
