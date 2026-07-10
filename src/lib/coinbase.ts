import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Coinbase Commerce client (hosted crypto checkout). Optional: without an API
// key the crypto payment option is hidden and everything else works.
const API_KEY = process.env.COINBASE_COMMERCE_API_KEY ?? "";
const WEBHOOK_SECRET = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET ?? "";
const API = "https://api.commerce.coinbase.com";

export function coinbaseConfigured(): boolean {
  return Boolean(API_KEY);
}

export interface CoinbaseCharge {
  code: string;
  hosted_url: string;
}

/** Create a fixed-price USD charge; the buyer pays in the crypto of their choice. */
export async function createCharge(opts: {
  name: string;
  description: string;
  amountCents: number;
  metadata: Record<string, string>;
  redirectUrl: string;
  cancelUrl: string;
}): Promise<CoinbaseCharge> {
  const res = await fetch(`${API}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": API_KEY,
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify({
      name: opts.name.slice(0, 100),
      description: opts.description.slice(0, 200),
      pricing_type: "fixed_price",
      local_price: { amount: (opts.amountCents / 100).toFixed(2), currency: "USD" },
      metadata: opts.metadata,
      redirect_url: opts.redirectUrl,
      cancel_url: opts.cancelUrl,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Coinbase charge failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: CoinbaseCharge };
  return json.data;
}

/** Verify Coinbase Commerce's X-CC-Webhook-Signature (HMAC-SHA256 of the raw body). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Days of access each pass buys. */
export const PASS_DAYS = { WEEKLY: 7, MONTHLY: 30, ANNUAL: 365 } as const;
export type PassInterval = keyof typeof PASS_DAYS;
