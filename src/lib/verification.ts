import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, verificationEmailHtml } from "@/lib/email";
import { siteUrl } from "@/lib/site";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Create a fresh email-verification token for an address (replacing any prior
 * ones) and email the verification link. Best-effort on the send: if email
 * isn't configured or fails, the token still exists so the user can retry.
 */
export async function sendVerificationEmail(email: string): Promise<void> {
  const identifier = email.toLowerCase();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({ data: { identifier, token, expires } });

  const url = `${siteUrl()}/verify-email?token=${token}`;

  // Without an email provider configured, surface the link in logs so local
  // dev can still complete verification.
  if (!process.env.RESEND_API_KEY) {
    console.log(`[verify] ${identifier} → ${url}`);
  }

  await sendEmail({
    to: identifier,
    subject: "Verify your email · Blitz.tips",
    html: verificationEmailHtml(url),
  });
}

/** Whether a user has confirmed their email — gates sensitive actions. */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  return Boolean(user?.emailVerified);
}

type VerifyResult = "verified" | "already" | "invalid" | "expired";

/**
 * Consume a verification token: mark the matching user verified and delete the
 * token. Returns a status for the result page to render.
 */
export async function consumeVerificationToken(token: string): Promise<VerifyResult> {
  if (!token) return "invalid";

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return "invalid";

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => undefined);
    return "expired";
  }

  const user = await prisma.user.findUnique({ where: { email: record.identifier } });
  await prisma.verificationToken.delete({ where: { token } }).catch(() => undefined);
  if (!user) return "invalid";
  if (user.emailVerified) return "already";

  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  return "verified";
}
