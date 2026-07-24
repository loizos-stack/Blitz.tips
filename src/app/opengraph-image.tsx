import { ImageResponse } from "next/og";

// Default social-share card for every page that doesn't provide its own.
export const alt = "Blitz.tips — Follow the sharpest sports handicappers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0a1410 0%, #0d1f16 55%, #123524 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
              color: "#0a1410",
            }}
          >
            B
          </div>
          <div style={{ display: "flex", marginLeft: 20, fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>
            <span>Blitz</span>
            <span style={{ color: "#22c55e" }}>.tips</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 48, fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>
          <span>Follow sports handicappers with a</span>
          <span style={{ color: "#22c55e" }}>verified track record.</span>
        </div>

        <div style={{ display: "flex", marginTop: 40, fontSize: 30, color: "#94a3b8" }}>
          <span>Verified records</span>
          <span style={{ color: "#334155", margin: "0 22px" }}>•</span>
          <span>Units &amp; ROI</span>
          <span style={{ color: "#334155", margin: "0 22px" }}>•</span>
          <span>Subscriber reviews</span>
        </div>
      </div>
    ),
    size
  );
}
