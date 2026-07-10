import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// NOWPayments client (hosted crypto checkout via invoices). Optional: without
// an API key the crypto payment option is hidden and everything else works.
// NOWPAYMENTS_API_BASE can point at their sandbox for testing.
const API_KEY = process.env.NOWPAYMENTS_API_KEY ?? "";
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET ?? "";
const API = (process.env.NOWPAYMENTS_API_BASE ?? "https://api.nowpayments.io").replace(/\/+$/, "");

export function nowPaymentsConfigured(): boolean {
  return Boolean(API_KEY);
}

export interface NowInvoice {
  id: string;
  invoice_url: string;
}

/** Create a fixed-price USD invoice; the buyer picks their coin on the hosted page. */
export async function createInvoice(opts: {
  orderId: string;
  description: string;
  amountCents: number;
  ipnUrl: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<NowInvoice> {
  const res = await fetch(`${API}/v1/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      price_amount: Number((opts.amountCents / 100).toFixed(2)),
      price_currency: "usd",
      order_id: opts.orderId,
      order_description: opts.description.slice(0, 200),
      ipn_callback_url: opts.ipnUrl,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NOWPayments invoice failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id: string | number; invoice_url: string };
  return { id: String(json.id), invoice_url: json.invoice_url };
}

/** JSON.stringify with recursively sorted keys — the exact form NOWPayments signs. */
function sortedStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortDeep((value as Record<string, unknown>)[k])])
    );
  }
  return value;
}

/**
 * Verify NOWPayments' x-nowpayments-sig header: HMAC-SHA512 (hex) of the IPN
 * body with alphabetically sorted keys, keyed by the IPN secret.
 */
export function verifyIpnSignature(body: unknown, signature: string | null): boolean {
  if (!IPN_SECRET || !signature) return false;
  const expected = createHmac("sha512", IPN_SECRET).update(sortedStringify(body)).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Days of access each pass buys. */
export const PASS_DAYS = { WEEKLY: 7, MONTHLY: 30, ANNUAL: 365 } as const;
export type PassInterval = keyof typeof PASS_DAYS;
