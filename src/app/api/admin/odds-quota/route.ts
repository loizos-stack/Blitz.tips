import { NextResponse } from "next/server";
import { upstreamFailed } from "@/lib/api-status";
import { requirePermission } from "@/lib/permissions";
import { oddsApiDisabled, oddsApiKey } from "@/lib/odds-api";

const API_BASE = process.env.ODDS_API_BASE ?? "https://api.the-odds-api.com/v4";

// Reads the live credit counters from The Odds API's response headers. The
// /sports endpoint is free, so checking costs nothing.
export async function GET() {
  const ctx = await requirePermission("system");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  // Told apart so the screen doesn't report a missing key when the key is
  // present and the feed was turned off on purpose.
  if (oddsApiDisabled()) {
    return NextResponse.json(
      { error: "The paid odds feed is switched off (ODDS_API_DISABLED). The board is running on ESPN." },
      { status: 400 }
    );
  }
  const apiKey = oddsApiKey();
  if (!apiKey) return NextResponse.json({ error: "THE_ODDS_API_KEY not configured" }, { status: 400 });

  try {
    const res = await fetch(`${API_BASE}/sports?apiKey=${apiKey}`, { cache: "no-store" });
    if (!res.ok) {
      return upstreamFailed(`Odds API responded ${res.status}`);
    }
    return NextResponse.json({
      remaining: res.headers.get("x-requests-remaining"),
      used: res.headers.get("x-requests-used"),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
