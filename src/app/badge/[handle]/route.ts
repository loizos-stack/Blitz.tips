import { prisma } from "@/lib/prisma";
import { computeStats } from "@/lib/odds";

/**
 * A handicapper's verified record as an SVG anyone can hotlink.
 *
 *   <img src="https://blitz.tips/badge/sharpsteve.svg" alt="Verified record">
 *
 * Deliberately an image rather than a script embed. A capper can drop it on a
 * Squarespace page, a forum signature or a Substack — places that allow an
 * <img> and nothing else — and it needs no JS, no iframe and no cooperation
 * from the host page's CSP. It's also the only form that works as a plain link
 * in a bio.
 *
 * Three things this is doing at once: giving the capper a credibility artifact
 * they can't fake, putting the brand on other people's pages, and earning
 * links back — which is the one SEO lever available without waiting for content
 * to age.
 *
 * The numbers are read live and cached for an hour. A record only moves as
 * picks settle, and an hour-stale badge is honest in a way a hand-typed one on
 * someone's own site never is.
 */
export const revalidate = 3600;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await params;
  // The route is registered as /badge/[handle]; ".svg" is conventional in the
  // URL people paste, so accept it either way.
  const handle = raw.replace(/\.svg$/i, "");

  const profile = await prisma.handicapperProfile.findUnique({
    where: { handle },
    select: {
      displayName: true,
      handle: true,
      suspendedAt: true,
      isVerified: true,
      picks: { select: { odds: true, units: true, result: true } },
    },
  });

  // A suspended profile is hidden everywhere else; a badge that kept rendering
  // would be the one place its record survived.
  if (!profile || profile.suspendedAt) {
    return new Response("Not found", { status: 404 });
  }

  const stats = computeStats(profile.picks);
  const graded = stats.totalPicks - stats.pending;
  const units = `${stats.unitsNet >= 0 ? "+" : ""}${stats.unitsNet.toFixed(1)}u`;
  const roi = stats.roi !== null ? `${stats.roi.toFixed(1)}%` : "—";
  const up = stats.unitsNet >= 0;

  // System font stack, because a webfont inside an SVG served cross-origin is
  // a coin toss — and a badge that renders in a fallback face still reads.
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="132" viewBox="0 0 440 132" role="img" aria-label="${esc(profile.displayName)} verified record on Blitz.tips">
  <rect width="440" height="132" rx="14" fill="#0b0f14"/>
  <rect x="0.5" y="0.5" width="439" height="131" rx="13.5" fill="none" stroke="#1f2937"/>

  <g transform="translate(18,18)">
    <path d="M12 0 L3 13 H8.5 L6 24 L17 10 H11 L13.5 0 Z" fill="#eab308"/>
    <text x="24" y="13" font-family="${font}" font-size="14" font-weight="700" fill="#ffffff">Blitz<tspan fill="#22c55e">.tips</tspan></text>
    <text x="404" y="13" text-anchor="end" font-family="${font}" font-size="11" font-weight="600" fill="#6b7280">VERIFIED RECORD</text>
  </g>

  <text x="18" y="66" font-family="${font}" font-size="19" font-weight="700" fill="#ffffff">${esc(profile.displayName)}</text>
  <text x="18" y="84" font-family="${font}" font-size="12" fill="#6b7280">@${esc(profile.handle)} · ${graded} graded pick${graded === 1 ? "" : "s"}</text>

  <g font-family="${font}" text-anchor="middle">
    <text x="238" y="70" font-size="20" font-weight="800" fill="#e5e7eb">${esc(stats.record)}</text>
    <text x="238" y="88" font-size="10" font-weight="600" fill="#6b7280">RECORD</text>

    <text x="320" y="70" font-size="20" font-weight="800" fill="${up ? "#22c55e" : "#ef4444"}">${esc(units)}</text>
    <text x="320" y="88" font-size="10" font-weight="600" fill="#6b7280">UNITS</text>

    <text x="398" y="70" font-size="20" font-weight="800" fill="${up ? "#22c55e" : "#ef4444"}">${esc(roi)}</text>
    <text x="398" y="88" font-size="10" font-weight="600" fill="#6b7280">ROI</text>
  </g>

  <text x="18" y="114" font-family="${font}" font-size="11" fill="#4b5563">Every pick timestamped before kickoff · blitz.tips/handicappers/${esc(profile.handle)}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Long public cache with revalidation — these are embedded on other
      // people's pages and shouldn't hammer the database.
      "cache-control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
      // Explicitly embeddable: the whole point is other origins.
      "access-control-allow-origin": "*",
    },
  });
}
