/**
 * The stake, as a chip.
 *
 * Shared by the public pick card and the handicapper's own row, which is the
 * point: the public card used to carry its own copy of this markup at
 * `text-base`, so the stake was printed a size larger than the Odds and
 * Selection it sits under and read as the loudest thing on the card. Two copies
 * of one chip in two files is exactly how that happens.
 *
 * Sized a notch below the values it sits among, and padded tightly. It is a
 * chip, not a button: at `text-sm` in `px-2 py-0.5` it read as the heaviest
 * thing in the column, which put the emphasis on the stake rather than on
 * the bet. The size is set here rather than inherited so it stays put
 * wherever the chip is used.
 */
export function UnitsRisk({ units }: { units: number }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-px">
      <span className="text-xs font-bold tabular-nums text-accent">{units}u</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-accent/80">risk</span>
    </span>
  );
}
