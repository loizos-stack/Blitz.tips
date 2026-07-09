import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readParlayFromImage, isOcrConfigured } from "@/lib/parlay-ocr";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const profile = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Handicapper profile required" }, { status: 403 });

  if (!isOcrConfigured()) {
    return NextResponse.json(
      { configured: false, error: "Bet-slip reading isn't enabled on this server. Add the legs manually or from the schedule." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const image = typeof body.image === "string" ? body.image : "";
  if (!image) return NextResponse.json({ error: "No image provided" }, { status: 400 });
  if (image.length > 8_000_000) {
    return NextResponse.json({ error: "That image is too large — please use one under ~5 MB." }, { status: 400 });
  }

  try {
    const legs = await readParlayFromImage(image);
    return NextResponse.json({ legs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't read the image";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
