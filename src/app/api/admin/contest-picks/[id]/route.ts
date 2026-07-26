import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import type { PickResult } from "@prisma/client";

const RESULTS: PickResult[] = ["PENDING", "WIN", "LOSS", "PUSH", "VOID"];

// Grade (or re-grade) a single contest pick. Admin-only — contest scoring rides
// on these, so grading stays with staff.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("contests");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = body.result as PickResult;
  if (!RESULTS.includes(result)) {
    return NextResponse.json({ error: "Invalid result" }, { status: 400 });
  }

  const pick = await prisma.contestPick.update({
    where: { id },
    data: {
      result,
      settledAt: result === "PENDING" ? null : new Date(),
      settledBy: result === "PENDING" ? null : ctx.userId,
    },
  });

  await logAdmin(ctx.session, "contest.grade", "ContestPick", id, `${pick.matchup} → ${result}`);
  return NextResponse.json({ pick });
}
