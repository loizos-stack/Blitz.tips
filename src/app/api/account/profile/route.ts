import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { accountProfileSchema } from "@/lib/validations";
import { COUNTRIES } from "@/lib/countries";
import { logActivity } from "@/lib/audit";

// Update the signed-in user's own account details: name, email, and country.
// Username is immutable and never changed here.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = accountProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, email, country } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  if (country && !COUNTRIES.includes(country)) {
    return NextResponse.json({ error: "Select a valid country" }, { status: 400 });
  }

  // Email must stay unique across users.
  const clash = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (clash && clash.id !== session.user.id) {
    return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name, email: normalizedEmail, country: country ? country : null },
    });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    }
    throw e;
  }

  await logActivity({
    actorId: session.user.id,
    actorEmail: normalizedEmail,
    action: "account.update",
    targetType: "User",
    targetId: session.user.id,
    detail: "Updated account details",
  });

  return NextResponse.json({ ok: true });
}
