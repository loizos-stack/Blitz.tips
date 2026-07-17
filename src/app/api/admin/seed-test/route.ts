import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminContext } from "@/lib/permissions";
import { seedTestData } from "@/lib/test-seed";

// TEMPORARY: one-off endpoint to load the 15 test handicappers into whatever DB
// this deployment points at (used to populate the live/preview DB, since the
// CLI seed can't reach it). Admin-gated and idempotent. Remove after use.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const result = await seedTestData(prisma);
  return NextResponse.json({ ok: true, ...result, note: "Test data seeded. Ask to remove this endpoint when done." });
}
