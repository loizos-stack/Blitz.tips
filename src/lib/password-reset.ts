import "server-only";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail, passwordResetEmailHtml, passwordResetEmailText } from "@/lib/email";
import { siteUrl } from "@/lib/site";
import { logActivity } from "@/lib/audit";

/**
 * Forgotten-password reset by emailed link.
 *
 * TWO RULES SHAPE EVERYTHING HERE.
 *
 * First, the request endpoint is public and unauthenticated, so it must never
 * reveal whether an address has an account. Every path through
 * `sendPasswordReset` returns the same nothing, and the caller renders the same
 * confirmation either way. This is why the function returns void rather than a
 * status the route could accidentally leak.
 *
 * Second, a reset token is a bearer credential for the account — stronger than
 * the password itself, since it needs no other knowledge. So it is 32 random
 * bytes, stored only as a hash, valid for one hour, and consumed on first use.
 */

// Short by design. An hour is long enough to find the mail, switch devices and
// type a new password; a day would leave a working key to the account sitting
// in an inbox that may itself be the thing that was compromised.
const TTL_MS = 60 * 60 * 1000;
export const RESET_TTL_MINUTES = TTL_MS / 60_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Issue a reset link for an address, if it belongs to an account that can use
 * one. Silent about the outcome in every case — see the note above.
 *
 * Best-effort on the send: the token is written first, so a mail provider
 * hiccup leaves a link the user can obtain by asking again rather than an
 * account stuck half-way through a reset.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const identifier = email.trim().toLowerCase();
  if (!identifier) return;

  const user = await prisma.user.findUnique({
    where: { email: identifier },
    select: { id: true, suspendedAt: true },
  });

  // No account, or a banned one. Both stop here, and both look identical from
  // outside — a suspended user who could still reset their password would have
  // a way back in that the ban is supposed to close.
  if (!user || user.suspendedAt) return;

  // Clear any earlier links for this address. Asking again should invalidate
  // the previous mail rather than leave several working keys in an inbox.
  await prisma.passwordResetToken.deleteMany({ where: { identifier } });

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      identifier,
      tokenHash: hashToken(token),
      expires: new Date(Date.now() + TTL_MS),
    },
  });

  const url = `${siteUrl()}/reset-password?token=${token}`;

  // Without a mail provider configured, surface the link so local development
  // can complete the flow — the same affordance the verification flow has.
  if (!process.env.RESEND_API_KEY) {
    console.log(`[reset] ${identifier} → ${url}`);
  }

  await sendEmail({
    to: identifier,
    subject: "Reset your Blitz.tips password",
    html: passwordResetEmailHtml(url, RESET_TTL_MINUTES),
    text: passwordResetEmailText(url, RESET_TTL_MINUTES),
  });
}

export type ResetResult = "reset" | "invalid" | "expired";

/**
 * Check a token without spending it, so the reset page can show a dead link as
 * dead before asking someone to type a new password twice.
 */
export async function resetTokenState(token: string): Promise<"valid" | "invalid" | "expired"> {
  if (!token) return "invalid";
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expires: true },
  });
  if (!record) return "invalid";
  return record.expires < new Date() ? "expired" : "valid";
}

/**
 * Consume a reset token and set the new password.
 *
 * Deliberately does three things beyond writing the hash:
 *
 * - Clears the brute-force lockout. Someone locked out after failed attempts is
 *   the single most likely person to be resetting a password, and leaving them
 *   locked out would mean the reset appeared to work and then didn't.
 * - Marks the email verified if it wasn't. Following a link sent to that
 *   address is proof of control over it — the same proof the verification mail
 *   asks for — so continuing to nag for it would be theatre.
 * - Deletes every outstanding token for the address, not just this one.
 *
 * NOT done, and worth knowing: existing signed-in sessions elsewhere are not
 * revoked. Sessions here are JWTs (see src/auth.ts), so there is no server-side
 * session row to delete; ending them would need a token-version claim checked on
 * every request. That is a real gap if the account was taken over, and the fix
 * belongs with the session strategy rather than here.
 */
export async function resetPassword(token: string, newPassword: string): Promise<ResetResult> {
  if (!token) return "invalid";

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record) return "invalid";

  if (record.expires < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => undefined);
    return "expired";
  }

  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
    select: { id: true, email: true, emailVerified: true, suspendedAt: true },
  });

  // The account went away or was suspended between the request and the click.
  if (!user || user.suspendedAt) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => undefined);
    return "invalid";
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        ...(user.emailVerified ? {} : { emailVerified: new Date() }),
      },
    }),
    prisma.passwordResetToken.deleteMany({ where: { identifier: record.identifier } }),
  ]);

  await logActivity({
    actorId: user.id,
    actorEmail: user.email,
    action: "account.password_reset",
    targetType: "User",
    targetId: user.id,
    detail: "Reset password via emailed link",
  });

  return "reset";
}
