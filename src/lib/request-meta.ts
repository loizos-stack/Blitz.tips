// Best-effort client IP + user agent from a request. On Vercel the real client
// IP arrives in x-forwarded-for (first hop) / x-real-ip.
export function clientMeta(request: Request): { ip: string | null; userAgent: string | null } {
  const xff = request.headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0]!.trim() : request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");
  return { ip: ip || null, userAgent: userAgent ? userAgent.slice(0, 400) : null };
}
