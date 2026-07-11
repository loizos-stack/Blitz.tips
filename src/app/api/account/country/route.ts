import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { COUNTRIES } from "@/lib/countries";

// Save the signed-in user's country (used by the Google-signup onboarding step,
// where country isn't collected on a registration form).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const country = typeof body?.country === "string" ? body.country : "";
  if (!COUNTRIES.includes(country)) {
    return NextResponse.json({ error: "Select your country" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { country } });
  return NextResponse.json({ ok: true });
}
