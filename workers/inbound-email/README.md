# Inbound email → ticket replies (Cloudflare Email Worker)

Threads a customer's email reply back into its Blitz.tips support ticket.

Cloudflare Email Routing (on a **dedicated subdomain**, so your Google Workspace
root inbox is untouched) delivers each reply to this Worker. The Worker parses
the message and POSTs `{ from, to, subject, text, html }` to the site's
`/api/inbound-email` webhook, which matches it to the ticket (by the
`reply+<ticketId>@…` address, or the `#REF` in the subject), appends it as a
customer message, reopens the ticket, and emails the team.

## One-time setup

Prerequisite: your domain's DNS is on Cloudflare.

1. **Pick the subdomain** used only for parsing replies, e.g. `parse.blitz.tips`.
   It must match `INBOUND_EMAIL_DOMAIN` in the site's environment.

2. **Enable Email Routing on that subdomain** (Cloudflare dashboard → your zone →
   Email → Email Routing → enable for the subdomain). Cloudflare adds MX records
   **on the subdomain only** — your root `blitz.tips` MX (Google Workspace) is
   not changed.

3. **Deploy this Worker:**
   ```bash
   cd workers/inbound-email
   npm install
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put WEBHOOK_URL      # https://blitz.tips/api/inbound-email
   npx wrangler secret put WEBHOOK_SECRET   # same value as INBOUND_WEBHOOK_SECRET on the site
   ```

4. **Route the subdomain to the Worker:** Email Routing → Routing rules → add a
   catch-all (or a rule matching `reply+*@parse.blitz.tips`) with the action
   **Send to a Worker → blitz-inbound-email**.

5. **Set the site env** (Vercel, Production) and redeploy:
   - `INBOUND_EMAIL_DOMAIN=parse.blitz.tips`
   - `INBOUND_WEBHOOK_SECRET=<the same secret you gave the Worker>`

## Test

Reply to any ticket email — it should appear as a customer message in the admin
**Tickets** tab and reopen the ticket. Until this is set up, replies simply go
to your `support@` inbox (they just aren't auto-threaded).
