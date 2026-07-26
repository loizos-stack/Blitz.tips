import "server-only";

const CONTACT_TO = process.env.CONTACT_EMAIL?.trim() || "support@blitz.tips";

/**
 * The address a customer replies to for a ticket email.
 *
 * When INBOUND_EMAIL_DOMAIN is configured (a dedicated subdomain that receives
 * via Cloudflare Email Routing, e.g. "parse.blitz.tips"), replies go to a single
 * fixed address on it — the local part defaults to "replies" and must match the
 * custom address you created in Cloudflare (override with INBOUND_EMAIL_LOCALPART
 * if you used a different name). The ticket is then matched from the #REF that
 * every ticket email carries in its subject and body. Without an inbound domain
 * we fall back to the support mailbox.
 */
export function ticketReplyAddress(): string {
  const domain = process.env.INBOUND_EMAIL_DOMAIN?.trim();
  if (!domain) return CONTACT_TO;
  const localPart = process.env.INBOUND_EMAIL_LOCALPART?.trim() || "replies";
  return `${localPart}@${domain}`;
}

/** Extract a ticket id from a plus-addressed recipient like
 *  `reply+<ticketId>@parse.blitz.tips`. Returns null if none match. Kept for
 *  setups that can route a per-ticket plus address; the fixed-address flow
 *  matches on the #REF instead. */
export function ticketIdFromAddresses(addresses: string[]): string | null {
  for (const raw of addresses) {
    const addr = parseEmailAddress(raw);
    const m = addr.match(/\+([a-z0-9]+)@/i);
    if (m) return m[1];
  }
  return null;
}

/** Find the 8-char ticket #REF in some text (subject or quoted body). */
export function ticketRefFromText(...texts: (string | undefined)[]): string | null {
  for (const t of texts) {
    const m = t?.match(/#([A-Za-z0-9]{8})\b/);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

/** Pull a bare lowercase email address out of a `Name <email>` string. */
export function parseEmailAddress(input: string): string {
  const m = input.match(/<([^>]+)>/);
  return (m ? m[1] : input).trim().toLowerCase();
}

/** Very small HTML→text fallback for when an inbound email has no plain-text
 *  part. Drops scripts/styles, turns block tags into newlines, strips the rest. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Best-effort strip of quoted history from an email reply so only the new text
 * is stored. Cuts at the first common quote marker or quoted (`>`) line. Falls
 * back to the full text if that would leave nothing.
 */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const markers = [
    /^On .+ wrote:$/i,
    /^-{3,}\s*Original Message\s*-{3,}/i,
    /^_{5,}/,
    /^From:\s.+/i,
    /^Sent from my /i,
  ];
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (markers.some((re) => re.test(t)) || t.startsWith(">")) break;
    out.push(line);
  }
  const result = out.join("\n").trim();
  return result || text.trim();
}
