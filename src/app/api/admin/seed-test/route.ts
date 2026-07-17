import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminContext } from "@/lib/permissions";
import { seedTestData } from "@/lib/test-seed";

// TEMPORARY: one-off endpoint to load / top up the test handicappers in whatever
// DB this deployment points at (the CLI seed can't reach the live DB). Admin-
// gated and idempotent — re-running only adds what's missing (e.g. the new
// player-prop and parlay picks). Remove after use.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const result = await seedTestData(prisma);
  return NextResponse.json({ ok: true, ...result, note: "Test data seeded/topped up. Ask to remove this endpoint when done." });
}
