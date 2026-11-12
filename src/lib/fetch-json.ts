/**
 * Read a JSON response without turning an HTTP error into a fake network error.
 *
 * The naive shape is:
 *
 *   const res = await fetch(url, ...);
 *   const json = await res.json();          // throws on a non-JSON body
 *   if (!res.ok) setError(json.error);
 *
 * wrapped in a try/catch that reports "couldn't reach the server". That is a
 * lie whenever the server *did* answer but with something that isn't JSON — a
 * gateway timeout, a platform 500, an HTML error page — and it hides the status
 * code, which is the one thing that would have identified the problem. The
 * symptom is a UI that says the network is down while the request is arriving
 * and failing server-side.
 *
 * This reads the body as text first, so a non-JSON error still surfaces its
 * status and a readable fragment. Genuine transport failures are still reported
 * as such, because those really are unreachable-server cases.
 */
export interface JsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Present whenever ok is false; always something a human can act on. */
  error: string | null;
}

/** Status codes worth naming, because the generic text for them is useless. */
function describe(status: number, snippet: string): string {
  if (status === 504 || status === 408) {
    return "The request timed out server-side. Large uploads are the usual cause.";
  }
  if (status === 413) return "The request body was too large for the server to accept.";
  if (status === 401 || status === 403) return "Not authorised — try signing in again.";
  if (status === 404) return "That endpoint doesn't exist on this deployment.";
  if (status >= 500) {
    return `The server errored (${status})${snippet ? `: ${snippet}` : "."}`;
  }
  return `Request failed (${status})${snippet ? `: ${snippet}` : "."}`;
}

export async function fetchJson<T = Record<string, unknown>>(
  input: string,
  init?: RequestInit
): Promise<JsonResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    // Only here is "couldn't reach the server" actually true.
    return { ok: false, status: 0, data: null, error: "Couldn't reach the server — check your connection." };
  }

  const body = await res.text().catch(() => "");

  let parsed: unknown = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    // Non-JSON body. Keep a short, single-line fragment: an HTML error page is
    // mostly markup, and pasting a kilobyte of it into a toast helps nobody.
    const snippet = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    return { ok: false, status: res.status, data: null, error: describe(res.status, snippet) };
  }

  const data = parsed as T | null;
  if (!res.ok) {
    const fromBody =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : null;
    return { ok: false, status: res.status, data, error: fromBody ?? describe(res.status, "") };
  }

  return { ok: true, status: res.status, data, error: null };
}
