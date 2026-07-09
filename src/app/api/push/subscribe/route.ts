import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { pushConfigured, vapidPublicKey } from "@/lib/push";

// Whether push is available and the VAPID public key the browser needs to
// subscribe.
export async function GET() {
  return NextResponse.json({ configured: pushConfigured(), publicKey: vapidPublicKey() });
}

// Register (or refresh) a browser push subscription for the current user.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = body.keys?.p256dh;
  const authKey = body.keys?.auth;
  if (!endpoint || typeof p256dh !== "string" || typeof authKey !== "string") {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Endpoint is unique; upsert so re-subscribing (or moving devices) is clean
  // and the subscription always points at the current user.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.user.id, endpoint, p256dh, auth: authKey },
    update: { userId: session.user.id, p256dh, auth: authKey },
  });

  return NextResponse.json({ ok: true });
}

// Remove a subscription (on unsubscribe / permission revoke).
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (endpoint) {
    await prisma.pushSubscription
      .deleteMany({ where: { endpoint, userId: session.user.id } })
      .catch(() => null);
  }
  return NextResponse.json({ ok: true });
}
