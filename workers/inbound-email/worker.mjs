import PostalMime from "postal-mime";

// Cloudflare Email Worker for Blitz.tips ticket replies.
//
// Cloudflare Email Routing (enabled on a dedicated subdomain, e.g.
// parse.blitz.tips — so the root MX / Google Workspace inbox is untouched)
// delivers each inbound message here. We parse the MIME, then POST the useful
// bits to the site's /api/inbound-email webhook, which threads the reply back
// into its support ticket.
//
// Bindings (set with `wrangler secret put`):
//   WEBHOOK_URL     e.g. https://blitz.tips/api/inbound-email
//   WEBHOOK_SECRET  must equal INBOUND_WEBHOOK_SECRET in the site's env
export default {
  async email(message, env) {
    let parsed = {};
    try {
      parsed = await PostalMime.parse(message.raw);
    } catch (err) {
      console.error("parse failed", err);
    }

    const payload = {
      // Envelope addresses are the most reliable: `to` carries the per-ticket
      // reply+<id>@… address; `from` is the customer.
      from: message.from || parsed.from?.address || "",
      to: message.to || "",
      subject: parsed.subject || message.headers.get("subject") || "",
      text: parsed.text || "",
      html: parsed.html || "",
    };

    const res = await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    // A non-2xx means the site couldn't record it — reject so the sender is
    // informed rather than the reply vanishing silently.
    if (!res.ok) {
      message.setReject(`Webhook returned ${res.status}`);
    }
  },
};
