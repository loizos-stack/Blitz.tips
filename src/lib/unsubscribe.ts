import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { siteUrl } from "@/lib/site";

// One-click unsubscribe links for non-operational (marketing/notification)
// emails. The link carries a signed token so no login is needed; verifying it
// yields the user id, and unsubscribing flips their notifyEmail preference off.
//
// Transactional/operational mail (email verification, support tickets, receipts)
// must NOT carry these links and is unaffected by the preference.

const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(userId: string): string {
  return createHmac("sha256", secret).update(userId).digest("base64url");
}

/** A signed, URL-safe token that identifies the user for unsubscribe. */
export function unsubscribeToken(userId: string): string {
  return `${b64url(userId)}.${sign(userId)}`;
}

/** Verify a token and return the user id, or null if it's invalid/tampered. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  let userId: string;
  try {
    userId = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
  } catch {
    return null;
  }
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(userId));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}

/** Human-facing unsubscribe page URL for an email footer. */
export function unsubscribeUrl(userId: string): string {
  return `${siteUrl()}/unsubscribe?token=${encodeURIComponent(unsubscribeToken(userId))}`;
}

/** One-click (RFC 8058) endpoint URL for the List-Unsubscribe header. */
export function unsubscribePostUrl(userId: string): string {
  return `${siteUrl()}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken(userId))}`;
}
