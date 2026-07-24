import "server-only";
import { siteUrl } from "@/lib/site";

// Shared visual shell for every outbound email (verification, notifications,
// contact form, admin broadcasts) so mail always looks like it came from the
// same product: a centered logo header, a white card body, and a plain footer.
// The dark wordmark is used since email clients render on a white background.
const BRAND_GREEN = "#16a34a";
const LOGO_URL = `${siteUrl()}/logo-lockup-dark.png`;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A pill-shaped call-to-action link in the site's accent color. */
export function emailLinkPill(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:${BRAND_GREEN};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:1;padding:13px 28px;border-radius:999px;">${escapeHtml(label)}</a>`;
}

/**
 * Wraps email body content in the branded card: centered logo header on top,
 * the given HTML in the middle, and a standard footer below.
 */
export function emailWrapper({
  preheader,
  bodyHtml,
  unsubscribeUrl,
}: {
  preheader?: string;
  bodyHtml: string;
  // Only set for non-operational (marketing/notification) emails — adds an
  // unsubscribe line to the footer. Transactional mail leaves it undefined.
  unsubscribeUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blitz.tips</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f2f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f2f4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
            <tr>
              <td align="center" style="padding:32px 24px 24px;background-color:#ffffff;">
                <img src="${LOGO_URL}" alt="Blitz.tips" width="150" style="display:block;border:0;outline:none;height:auto;max-width:150px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px;color:#13161c;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="center" style="padding:20px 24px 0;">
                <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">
                  Blitz.tips &mdash; the marketplace for verified sports handicappers.<br />
                  You&rsquo;re receiving this because you have an account on blitz.tips.
                  ${
                    unsubscribeUrl
                      ? `<br /><a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe from these emails</a>`
                      : ""
                  }
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
