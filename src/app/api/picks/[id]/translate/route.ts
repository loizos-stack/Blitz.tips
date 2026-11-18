import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPickLocked } from "@/lib/pick-visibility";
import { isSubscriptionActive } from "@/lib/subscription-status";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientMeta } from "@/lib/request-meta";
import { normalizeLanguage, translatePickAnalysis } from "@/lib/translate";

export const dynamic = "force-dynamic";
// The first translation of a write-up is a model call. Every one after it is a
// row read, but the first has to be allowed to finish.
export const maxDuration = 60;

/**
 * Translate one pick's write-up.
 *
 * Body: `{ "to": "en" }` — a language tag, validated against the table in
 * lib/translate.ts rather than passed through, because it reaches a prompt.
 *
 * Two rules the endpoint enforces rather than trusting the card for:
 *
 * 1. **A locked pick is never translated.** The analysis of a premium pick is
 *    the thing a subscription buys. The card already hides it, but the card is
 *    not the boundary — this route is reachable with any pick id, and
 *    translating one would hand over the paid write-up to anyone who guessed.
 *    Same check, same helper, as the tail endpoint.
 * 2. **Signed out is allowed, but rate limited by address.** A reader who
 *    cannot read the tip is exactly who this is for, and most of them are not
 *    signed in. Each uncached translation costs money, so the limit is what
 *    stops a stranger spending it in a loop.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  // Keyed per account when we have one, per address otherwise. A shared
  // network is throttled together, which is the price of serving signed-out
  // readers at all.
  const who = session?.user?.id ?? clientMeta(request).ip ?? "anon";
  const limit = await rateLimit(`pick-translate:${who}`, 20, 60);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { to?: unknown } | null;
  const target = normalizeLanguage(typeof body?.to === "string" ? body.to : null);
  if (!target) {
    return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
  }

  const pick = await prisma.pick.findUnique({
    where: { id },
    select: {
      id: true,
      analysis: true,
      isPremium: true,
      result: true,
      eventStartsAt: true,
      handicapperId: true,
      handicapper: { select: { userId: true } },
    },
  });
  if (!pick) return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  if (!pick.analysis?.trim()) {
    return NextResponse.json({ error: "This pick has no write-up to translate." }, { status: 400 });
  }

  // Rule 1. The owner reads their own work; a subscriber reads what they paid
  // for; everyone else gets the same refusal the card gives them.
  const isOwner = Boolean(session?.user?.id) && pick.handicapper.userId === session!.user.id;
  let unlocked = isOwner;
  if (!unlocked && session?.user?.id) {
    const subscription = await prisma.subscription.findUnique({
      where: {
        subscriberId_handicapperId: {
          subscriberId: session.user.id,
          handicapperId: pick.handicapperId,
        },
      },
    });
    unlocked = isSubscriptionActive(subscription);
  }
  if (isPickLocked(pick, unlocked)) {
    return NextResponse.json({ error: "Subscribe to read this pick." }, { status: 403 });
  }

  const result = await translatePickAnalysis({
    pickId: pick.id,
    analysis: pick.analysis,
    target,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  return NextResponse.json({
    text: result.text,
    sourceLanguage: result.sourceLanguage,
    sameLanguage: result.sameLanguage,
  });
}
