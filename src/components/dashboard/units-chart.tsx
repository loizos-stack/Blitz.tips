// Tiny dependency-free area/line chart of cumulative units over settled picks.
// Server component: it only renders the numbers it's handed.
export function UnitsChart({ points, className = "" }: { points: number[]; className?: string }) {
  if (points.length < 2) {
    return (
      <div className={`flex h-40 items-center justify-center text-sm text-muted ${className}`}>
        Not enough settled picks yet to chart.
      </div>
    );
  }

  // Always include the zero baseline in the vertical range so gains and losses
  // read correctly relative to break-even.
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;
  const stepX = 100 / (points.length - 1);

  const coords = points.map((v, i) => {
    const x = i * stepX;
    const y = 100 - ((v - min) / range) * 100;
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L100,100 L0,100 Z`;
  const zeroY = 100 - ((0 - min) / range) * 100;

  const last = points[points.length - 1];
  const up = last >= 0;
  const stroke = up ? "var(--color-accent)" : "var(--color-danger)";

  return (
    <div className={className}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full">
        <line
          x1="0"
          y1={zeroY.toFixed(2)}
          x2="100"
          y2={zeroY.toFixed(2)}
          stroke="var(--color-border)"
          strokeWidth="1"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
        <path d={area} fill={stroke} fillOpacity="0.12" />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
