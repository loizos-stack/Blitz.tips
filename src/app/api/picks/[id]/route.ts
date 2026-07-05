import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { settlePickSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await params;

  const pick = await prisma.pick.findUnique({ where: { id }, include: { handicapper: true } });
  if (!pick) return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  if (pick.handicapper.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = settlePickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.pick.update({
    where: { id },
    data: {
      result: parsed.data.result,
      settledAt: parsed.data.result === "PENDING" ? null : new Date(),
      // Audit who graded it — self-settled picks are flagged in the admin
      // panel so suspicious grading can be spot-checked.
      settledBy: parsed.data.result === "PENDING" ? null : session.user.id,
    },
  });

  return NextResponse.json({ pick: updated });
}
