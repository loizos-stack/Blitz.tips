import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/password-reset";
import { passwordResetSchema } from "@/lib/validations";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Set a new password from an emailed link. Public: the token is the credential.
 *
 * Unlike the request endpoint, this one does say what went wrong. There is
 * nothing left to hide by then — whoever holds the token already has whatever
 * the link revealed — and "invalid or expired" with no way to tell which sends
 * people round the loop again for a link that was merely a few minutes stale.
 */
export async function POST(request: Request) {
  // A token is 32 random bytes, so guessing is not the threat; this is here so
  // a flood of submissions cannot turn into a flood of bcrypt hashes, which are
  // deliberately expensive and would otherwise be a cheap way to burn CPU.
  const limit = await rateLimit(`reset-password:ip:${clientIp(request)}`, 10, 15 * 60);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = passwordResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const result = await resetPassword(parsed.data.token, parsed.data.newPassword);
  if (result === "reset") return NextResponse.json({ ok: true });

  const message = {
    expired: "That reset link has expired. Request a new one and it'll arrive in a moment.",
    invalid: "That reset link is invalid or has already been used. Request a new one.",
  }[result];

  return NextResponse.json({ error: message }, { status: 400 });
}
