import "server-only";

const CONTACT_TO = process.env.CONTACT_EMAIL?.trim() || "support@blitz.tips";

/**
 * The address a customer replies to for a ticket email.
 *
 * When INBOUND_EMAIL_DOMAIN is configured (a subdomain whose MX points at Resend
 * Inbound, e.g. "parse.blitz.tips"), we use a per-ticket plus-address so the
 * reply can be threaded back into the ticket automatically. The token after the
 * "+" is the ticket id itself, so matching an incoming reply is exact and needs
 * no guessing. Without an inbound domain we fall back to the support mailbox.
 */
export function ticketReplyAddress(ticketId: string): string {
  const domain = process.env.INBOUND_EMAIL_DOMAIN?.trim();
  return domain ? `reply+${ticketId}@${domain}` : CONTACT_TO;
}

/** Extract a ticket id from a plus-addressed recipient like
 *  `reply+<ticketId>@parse.blitz.tips`. Returns null if none match. */
export function ticketIdFromAddresses(addresses: string[]): string | null {
  for (const raw of addresses) {
    const addr = parseEmailAddress(raw);
    const m = addr.match(/\+([a-z0-9]+)@/i);
    if (m) return m[1];
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
