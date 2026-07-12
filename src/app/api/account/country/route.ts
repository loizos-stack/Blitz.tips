import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { COUNTRIES } from "@/lib/countries";
import { usernameSchema } from "@/lib/validations";

// Save the signed-in user's onboarding basics — country and (for Google
// signups, which have no registration form) a login username. Each field is
// saved only when provided and still missing, so returning users aren't forced
// to re-enter them.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { country: true, username: true },
  });
  if (!current) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const data: { country?: string; username?: string } = {};

  if (!current.country) {
    const country = typeof body?.country === "string" ? body.country : "";
    if (!COUNTRIES.includes(country)) {
      return NextResponse.json({ error: "Select your country" }, { status: 400 });
    }
    data.country = country;
  }

  if (!current.username) {
    const parsed = usernameSchema.safeParse(body?.username);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Choose a valid username" },
        { status: 400 }
      );
    }
    const taken = await prisma.user.findUnique({ where: { username: parsed.data } });
    if (taken && taken.id !== session.user.id) {
      return NextResponse.json({ error: "That username is taken" }, { status: 409 });
    }
    data.username = parsed.data;
  }

  if (Object.keys(data).length > 0) {
    try {
      await prisma.user.update({ where: { id: session.user.id }, data });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") {
        return NextResponse.json({ error: "That username is taken" }, { status: 409 });
      }
      throw e;
    }
  }
  return NextResponse.json({ ok: true });
}
