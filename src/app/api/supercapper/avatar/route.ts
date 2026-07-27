import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { saveProfileImage } from "@/lib/blob";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Upload the avatar shown wherever this entrant appears on the contest pages.
 *
 * Handicappers are refused rather than silently ignored: their contest identity
 * reuses their handicapper profile avatar (see entrantAvatar), so accepting an
 * upload here would store a picture that never renders anywhere.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // Uploads cost storage and run image bytes through the server, so cap them
  // well above what changing your mind a few times needs.
  const limit = await rateLimit(`contest-avatar:${session.user.id}`, 10, 3600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const [entry, handicapper] = await Promise.all([
    prisma.contestEntry.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.handicapperProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    }),
  ]);

  if (!entry) {
    return NextResponse.json({ error: "Enter the contest first." }, { status: 403 });
  }
  if (handicapper) {
    return NextResponse.json(
      {
        error:
          "Your contest picture comes from your handicapper profile — update it there and it changes everywhere.",
      },
      { status: 409 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 4MB)" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let url: string;
  try {
    url = await saveProfileImage(entry.id, "avatar", bytes, file.type, "contest-entries");
  } catch (error) {
    console.error("Contest avatar upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }

  await prisma.contestEntry.update({ where: { id: entry.id }, data: { avatarUrl: url } });

  return NextResponse.json({ url });
}

/** Remove the uploaded avatar and fall back to the account image / initials. */
export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const entry = await prisma.contestEntry.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (!entry) return NextResponse.json({ error: "No contest entry" }, { status: 403 });

  await prisma.contestEntry.update({ where: { id: entry.id }, data: { avatarUrl: null } });
  return NextResponse.json({ ok: true });
}
