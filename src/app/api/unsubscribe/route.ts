import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

// Unsubscribe from non-operational email. Public (the signed token is the auth),
// so it works straight from an email with no login. Serves both the human
// "Unsubscribe" page button and the RFC 8058 one-click List-Unsubscribe POST
// that mail clients send to the header URL.
async function unsubscribe(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  let token = url.searchParams.get("token");
  if (!token) {
    // One-click clients and the page may send the token in the body instead.
    const body = await request.clone().text().catch(() => "");
    const params = new URLSearchParams(body);
    token = params.get("token") ?? (() => {
      try {
        return (JSON.parse(body) as { token?: string }).token ?? null;
      } catch {
        return null;
      }
    })();
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });

  await prisma.user.update({ where: { id: userId }, data: { notifyEmail: false } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  return unsubscribe(request);
}
