import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SOCIAL_PLATFORMS, normalizeSocialUrl, type SocialField } from "@/lib/socials";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const profile = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Handicapper profile required" }, { status: 403 });

  const body = await request.json().catch(() => ({}));

  const data: Partial<Record<SocialField, string | null>> = {};
  try {
    for (const p of SOCIAL_PLATFORMS) {
      data[p.field] = normalizeSocialUrl(body[p.field]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid link";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await prisma.handicapperProfile.update({ where: { id: profile.id }, data });
  return NextResponse.json({ ok: true });
}
