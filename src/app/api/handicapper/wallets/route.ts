import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { payoutWalletsSchema } from "@/lib/validations";

// Save the handicapper's crypto payout wallets (internal — used by the platform
// to send their cut). Not surfaced publicly.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const profile = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Handicapper profile required" }, { status: 403 });

  const parsed = payoutWalletsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const eth = parsed.data.payoutEthAddress?.trim() || null;
  const btc = parsed.data.payoutBtcAddress?.trim() || null;

  await prisma.handicapperProfile.update({
    where: { id: profile.id },
    data: { payoutEthAddress: eth, payoutBtcAddress: btc },
  });

  return NextResponse.json({ payoutEthAddress: eth, payoutBtcAddress: btc });
}
