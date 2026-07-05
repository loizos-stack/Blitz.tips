import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";

const API_BASE = process.env.ODDS_API_BASE ?? "https://api.the-odds-api.com/v4";

// Reads the live credit counters from The Odds API's response headers. The
// /sports endpoint is free, so checking costs nothing.
export async function GET() {
  const ctx = await requirePermission("system");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "THE_ODDS_API_KEY not configured" }, { status: 400 });

  try {
    const res = await fetch(`${API_BASE}/sports?apiKey=${apiKey}`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: `Odds API responded ${res.status}` }, { status: 502 });
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
