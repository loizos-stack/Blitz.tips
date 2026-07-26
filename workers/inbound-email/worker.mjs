// Cloudflare Email Worker for Blitz.tips ticket replies.
//
// Cloudflare Email Routing (enabled on a dedicated subdomain, e.g.
// parse.blitz.tips — so the root MX / Google Workspace inbox is untouched)
// delivers each inbound message here. This Worker just forwards the raw message
// and its envelope to the site's /api/inbound-email webhook, which parses it and
// threads the reply back into its support ticket. It has NO dependencies, so it
// can be pasted straight into the Cloudflare dashboard's Worker editor.
//
// Two variables to set (dashboard: Worker → Settings → Variables):
//   WEBHOOK_URL     e.g. https://blitz.tips/api/inbound-email
//   WEBHOOK_SECRET  must equal INBOUND_WEBHOOK_SECRET in the site's env
export default {
  async email(message, env) {
    // The full MIME message as text (envelope from/to are provided separately).
    const raw = await new Response(message.raw).text();

    const res = await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WEBHOOK_SECRET}`,
      },
      body: JSON.stringify({
        from: message.from, // envelope sender (the customer)
        to: message.to, // envelope recipient (reply+<ticketId>@…)
        subject: message.headers.get("subject") || "",
        raw,
      }),
    });

    // A non-2xx means the site couldn't record it — reject so the sender is
    // informed rather than the reply vanishing silently.
    if (!res.ok) {
      message.setReject(`Webhook returned ${res.status}`);
    }
  },
};
