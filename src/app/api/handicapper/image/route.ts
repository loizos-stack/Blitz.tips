import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { saveProfileImage } from "@/lib/blob";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const profile = await prisma.handicapperProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Handicapper profile required" }, { status: 403 });
  }

  const form = await request.formData();
  const kind = form.get("kind");
  const file = form.get("file");

  if (kind !== "avatar" && kind !== "cover") {
    return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
  }
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
    url = await saveProfileImage(profile.id, kind, bytes, file.type);
  } catch (error) {
    console.error("Profile image upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }

  await prisma.handicapperProfile.update({
    where: { id: profile.id },
    data: kind === "avatar" ? { avatarUrl: url } : { coverUrl: url },
  });

  return NextResponse.json({ url });
}
