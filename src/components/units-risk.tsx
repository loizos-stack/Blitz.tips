/**
 * The stake, as a chip.
 *
 * Its own component because the prop layout and the plain one both draw it and
 * they sit in different branches of the same card — two copies of the same
 * markup in one file is exactly how the two layouts would drift.
 */
export function UnitsRisk({ units }: { units: number }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-0.5">
      <span className="font-bold tabular-nums text-accent">{units}u</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-accent/80">risk</span>
    </span>
  );
}
