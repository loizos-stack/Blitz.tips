import { ImageResponse } from "next/og";
import { listHandicapperSummaries } from "@/lib/handicappers";

// Dynamic social card for the leaderboard: the current top verified handicappers
// by net units. Shareable "link-bait" — the preview itself shows the ranking, so
// the post earns clicks before anyone even lands on the page.
export const alt = "Top verified sports handicappers on Blitz.tips";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const ACCENT = "#22c55e";
const MUTED = "#94a3b8";

export default async function Image() {
  let top: { displayName: string; handle: string; unitsNet: number; record: string }[] = [];
  try {
    const all = await listHandicapperSummaries();
    top = [...all]
      .sort((a, b) => b.stats.unitsNet - a.stats.unitsNet)
      .slice(0, 5)
      .map((h) => ({
        displayName: h.displayName,
        handle: h.handle,
        unitsNet: h.stats.unitsNet,
        record: h.stats.record,
      }));
  } catch {
    top = [];
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 72,
          background: "linear-gradient(135deg, #0a1410 0%, #0d1f16 55%, #123524 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
                fontWeight: 800,
                color: "#0a1410",
              }}
            >
              B
            </div>
            <div style={{ display: "flex", marginLeft: 16, fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
              <span>Blitz</span>
              <span style={{ color: ACCENT }}>.tips</span>
            </div>
          </div>
          <span style={{ display: "flex", fontSize: 26, color: MUTED }}>Verified leaderboard</span>
        </div>

        <div style={{ display: "flex", fontSize: 52, fontWeight: 800, marginTop: 28, lineHeight: 1.05 }}>
          <span>
            Top handicappers by <span style={{ color: ACCENT }}>net units</span>
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 32, gap: 14 }}>
          {(top.length > 0 ? top : [{ displayName: "Be the first", handle: "signup", unitsNet: 0, record: "—" }]).map(
            (h, i) => (
              <div
                key={h.handle}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: "18px 26px",
                }}
              >
                <span style={{ display: "flex", fontSize: 34, fontWeight: 800, color: MUTED, width: 56 }}>
                  {i + 1}
                </span>
                <span style={{ display: "flex", flex: 1, fontSize: 36, fontWeight: 700 }}>{h.displayName}</span>
                <span style={{ display: "flex", fontSize: 28, color: MUTED, marginRight: 28 }}>{h.record}</span>
                <span
                  style={{
                    display: "flex",
                    fontSize: 36,
                    fontWeight: 800,
                    color: h.unitsNet >= 0 ? ACCENT : "#f87171",
                  }}
                >
                  {h.unitsNet >= 0 ? "+" : ""}
                  {h.unitsNet.toFixed(1)}u
                </span>
              </div>
            )
          )}
        </div>
      </div>
    ),
    size
  );
}
