import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

// Public: the current site-wide announcement (empty string = none). Cached at
// the edge so the banner adds no meaningful load.
export async function GET() {
  const message = (await getSetting("announcement")) ?? "";
  return NextResponse.json(
    { message },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
