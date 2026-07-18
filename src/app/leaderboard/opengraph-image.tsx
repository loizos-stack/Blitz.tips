import { ImageResponse } from "next/og";
import { listHandicapperSummaries } from "@/lib/handicappers";
import { Wordmark } from "@/lib/share-cards";

// Dynamic social card for the leaderboard: the current top verified handicappers
// by net units. Shareable "link-bait" — the preview itself shows the ranking, so
// the post earns clicks before anyone even lands on the page. Styled like the
// on-site cards (light surface, raised rows).
export const alt = "Top verified sports handicappers on Blitz.tips";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const CANVAS = "#eef1f5";
const SURFACE = "#ffffff";
const RAISED = "#f1f3f6";
const BORDER = "#e3e6eb";
const FG = "#13161c";
const MUTED = "#4b5563";
const ACCENT = "#16a34a";
const DANGER = "#dc2626";

export default async function Image() {
  let top: { displayName: string; unitsNet: number; record: string }[] = [];
  try {
    const all = await listHandicapperSummaries();
    top = [...all]
      .sort((a, b) => b.stats.unitsNet - a.stats.unitsNet)
      .slice(0, 5)
      .map((h) => ({ displayName: h.displayName, unitsNet: h.stats.unitsNet, record: h.stats.record }));
  } catch {
    top = [];
  }
  const rows = top.length > 0 ? top : [{ displayName: "Be the first", unitsNet: 0, record: "—" }];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: 48, background: CANVAS, fontFamily: "sans-serif" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 28,
            boxShadow: "0 2px 10px rgba(16,24,40,0.06)",
            padding: 52,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Wordmark />
            <span style={{ display: "flex", fontSize: 24, color: MUTED }}>Verified leaderboard</span>
          </div>

          <div style={{ display: "flex", gap: 14, fontSize: 46, fontWeight: 800, color: FG, marginTop: 22, lineHeight: 1.05 }}>
            <span>Top handicappers by</span>
            <span style={{ color: ACCENT }}>net units</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 26, gap: 12 }}>
            {rows.map((h, i) => (
              <div
                key={h.displayName + i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: RAISED,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 16,
                  padding: "16px 26px",
                }}
              >
                <span style={{ display: "flex", fontSize: 32, fontWeight: 800, color: MUTED, width: 52 }}>{i + 1}</span>
                <span style={{ display: "flex", flex: 1, fontSize: 34, fontWeight: 700, color: FG }}>{h.displayName}</span>
                <span style={{ display: "flex", fontSize: 26, color: MUTED, marginRight: 28 }}>{h.record}</span>
                <span style={{ display: "flex", fontSize: 34, fontWeight: 800, color: h.unitsNet >= 0 ? ACCENT : DANGER }}>
                  {h.unitsNet >= 0 ? "+" : ""}
                  {h.unitsNet.toFixed(1)}u
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
