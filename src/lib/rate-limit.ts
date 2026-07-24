import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * A shared fixed-window rate limiter backed by the database, so it holds across
 * serverless instances (there's no Redis). Returns whether the call is allowed
 * and, when blocked, roughly how long until the window resets.
 *
 * Fail-open: if the DB check itself errors, we allow the request rather than
 * lock users out of core flows over a transient hiccup.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    if (!existing || now - existing.windowStart.getTime() >= windowMs) {
      // Fresh window (new key or the old window has fully elapsed).
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: new Date(now) },
        update: { count: 1, windowStart: new Date(now) },
      });
      return { ok: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= limit) {
      const retryAfterSeconds = Math.ceil((existing.windowStart.getTime() + windowMs - now) / 1000);
      return { ok: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }

    await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return { ok: true, retryAfterSeconds: 0 };
  } catch {
    return { ok: true, retryAfterSeconds: 0 };
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Standard 429 response with a Retry-After header. */
export function tooManyRequests(retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down and try again shortly." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
