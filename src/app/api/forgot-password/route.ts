import { NextResponse } from "next/server";
import { sendPasswordReset } from "@/lib/password-reset";
import { passwordResetRequestSchema } from "@/lib/validations";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Ask for a password-reset link. Public and unauthenticated.
 *
 * ALWAYS ANSWERS THE SAME WAY. Whether the address has an account, is
 * suspended, or was never seen before, this returns `{ ok: true }`. Anything
 * else turns the endpoint into a membership oracle: type an address, read the
 * response, learn whether that person has an account here — which, on a site
 * about betting, is not a harmless thing to leak.
 *
 * The same reasoning applies to timing, which is why the work is awaited rather
 * than fired off: an endpoint that returns instantly for strangers and slowly
 * for members leaks exactly what the uniform body is hiding.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = passwordResetRequestSchema.safeParse(body);

  // A malformed address is a client mistake, not an account signal — every
  // address is equally malformed regardless of who it belongs to.
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a valid email" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();

  // Two limits, because they stop different things. The per-address one stops
  // someone using us to flood a stranger's inbox; the per-IP one stops someone
  // walking a list of addresses to find out which are registered.
  const perEmail = await rateLimit(`forgot-password:email:${email}`, 3, 15 * 60);
  if (!perEmail.ok) return tooManyRequests(perEmail.retryAfterSeconds);

  const perIp = await rateLimit(`forgot-password:ip:${clientIp(request)}`, 10, 15 * 60);
  if (!perIp.ok) return tooManyRequests(perIp.retryAfterSeconds);

  // Never throws a status the caller could read a signal from; a mail failure
  // is logged upstream and still answers ok, since the user's remedy either way
  // is to ask again.
  try {
    await sendPasswordReset(email);
  } catch (e) {
    console.error("[forgot-password] send failed", e);
  }

  return NextResponse.json({ ok: true });
}
