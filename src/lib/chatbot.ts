import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * The on-site assistant. It runs in one of two modes:
 *
 *  - **AI mode** — when ANTHROPIC_API_KEY is set, visitor messages are answered
 *    by Claude using the FAQ knowledge below as its system prompt.
 *  - **Canned mode** — with no key configured (the default), a lightweight
 *    keyword matcher answers the most common questions and, for anything it
 *    doesn't recognise, offers to connect the visitor with a human.
 *
 * Either way the answer is grounded in the same facts, so switching AI on later
 * is purely an upgrade — no behavioural surprises.
 */

// How recently an agent must have pinged the presence heartbeat to count as
// "online". The admin Chat tab pings every ~20s, so a 60s window tolerates a
// missed beat without falsely showing an agent as available.
export const AGENT_ONLINE_WINDOW_MS = 60_000;

/** True when at least one admin/support agent is currently online. */
export async function agentsOnline(): Promise<boolean> {
  const cutoff = new Date(Date.now() - AGENT_ONLINE_WINDOW_MS);
  const count = await prisma.agentPresence.count({ where: { lastSeen: { gt: cutoff } } });
  return count > 0;
}

// Canonical facts about the product, shared by both modes. Kept in sync with the
// public FAQ page (src/app/faq/page.tsx).
export const KNOWLEDGE = `Blitz.tips is a marketplace where sports handicappers publish their picks and build a public, verified track record. Bettors browse a leaderboard, compare records, and subscribe to handicappers they trust.

Key facts:
- Records are verified: every pick is timestamped when posted (before the event starts) and graded from the final result. Picks can't be edited or deleted after kickoff, so win/loss records are real.
- "Units" are a handicapper's standard bet size so records stay comparable; "ROI" is profit divided by total units risked.
- Subscriptions: each handicapper sets their own weekly, monthly and/or annual price. Bettors subscribe via secure Stripe checkout and instantly unlock premium picks. Subscriptions renew automatically until cancelled.
- Cancelling: bettors can cancel any subscription from their dashboard at any time and keep access until the end of the paid period.
- Some handicappers offer a short free trial (e.g. a 1-day or 2-day trial) on a package.
- Payment methods: card (via Stripe) and, where a handicapper has set up crypto payout wallets, crypto (via NOWPayments).
- Sports covered: NFL, NBA, WNBA, MLB, NHL, college football and basketball, soccer, golf, tennis, UFC/MMA and more — it depends on the handicapper.
- No pick is guaranteed to win; sports betting carries risk. Blitz.tips makes past performance transparent but guarantees nothing.
- Becoming a handicapper: create an account, open the handicapper dashboard, set up a public profile and pricing, and start posting picks. It's free to start.
- Handicappers get paid via Stripe Connect to their connected bank account on Stripe's standard payout schedule, minus the platform commission for their plan (Silver or Gold).
- Handicappers set weekly, monthly and annual package prices from their dashboard. Price changes apply to new subscribers.
- Support: visitors can reach a human from this chat (if an agent is online) or via the Contact page, which opens a support ticket.`;

// Lightweight intent matcher for canned mode. Each rule matches on keywords in
// the visitor's message; the first match wins. Order matters — more specific
// rules come first.
interface CannedRule {
  test: RegExp;
  answer: string;
}

const CANNED_RULES: CannedRule[] = [
  {
    test: /\b(become|be|sign\s?up as|register as|apply).*(handicapper|capper|seller)|sell (my )?(picks|tips)\b/i,
    answer:
      "Becoming a handicapper is free. Create an account, open your handicapper dashboard, set up your public profile and pricing, then start posting picks. Your Silver or Gold plan sets the platform commission and the sports you can cover.",
  },
  {
    test: /\b(payout|get paid|withdraw|payment schedule|how (do|will) i get paid)\b/i,
    answer:
      "Handicappers are paid via Stripe Connect to their connected bank account on Stripe's standard payout schedule, minus the platform commission for their plan. You set up payouts from the Payouts tab of your dashboard.",
  },
  {
    test: /\b(crypto|bitcoin|btc|eth|usdt|nowpayments)\b/i,
    answer:
      "Where a handicapper has set up crypto payout wallets, subscribers can pay with crypto via NOWPayments in addition to card. You'll see a “Pay with crypto” option on their subscribe card when it's available.",
  },
  {
    test: /\b(trial|free trial)\b/i,
    answer:
      "Some handicappers offer a short trial (for example a 1-day or 2-day trial) on a package. If one is available you'll see a trial pill on that handicapper's subscribe card.",
  },
  {
    test: /\b(cancel|unsubscribe|stop (my )?subscription)\b/i,
    answer:
      "You can cancel any subscription from your dashboard at any time, in a couple of clicks. You keep access until the end of the period you've already paid for.",
  },
  {
    test: /\b(subscri|how (do|does).*(subscri|buy|purchase)|buy (a )?tips?|pricing|how much|price)\b/i,
    answer:
      "Each handicapper sets their own weekly, monthly and/or annual price. You subscribe through secure Stripe checkout and instantly unlock their premium picks in your feed. Subscriptions renew automatically until you cancel.",
  },
  {
    test: /\b(verif|track record|legit|real|proof|fake)\b/i,
    answer:
      "Every pick is timestamped the moment it's posted — before the event starts — and graded from the final result. Nobody can edit a pick after kickoff or delete a loss, so the records you see are real.",
  },
  {
    test: /\b(unit|roi|what.*mean)\b/i,
    answer:
      "A “unit” is a handicapper's standard bet size, so records stay comparable no matter how big anyone actually bets. “ROI” is total profit divided by the total units risked — higher and steadier is better.",
  },
  {
    test: /\b(sport|which (games|leagues)|nfl|nba|mlb|nhl|soccer|football|tennis|ufc|mma|golf)\b/i,
    answer:
      "Coverage includes NFL, NBA, WNBA, MLB, NHL, college football and basketball, soccer, golf, tennis, UFC/MMA and more — it depends on what each handicapper covers.",
  },
  {
    test: /\b(guarantee|will i win|sure thing|lock)\b/i,
    answer:
      "No pick is guaranteed to win — sports betting always carries risk. Blitz.tips makes past performance transparent so you can make informed choices, but nothing here is a guarantee of future results.",
  },
  {
    test: /\b(what is|what's|tell me about|about) blitz/i,
    answer:
      "Blitz.tips is a marketplace where sports handicappers publish their picks and build a public, verified track record. You can browse the leaderboard, compare records, and subscribe to the handicappers you trust.",
  },
  {
    test: /\b(hi|hello|hey|yo|good (morning|afternoon|evening))\b/i,
    answer:
      "Hi! I'm the Blitz.tips assistant. Ask me about subscribing to handicappers, how records are verified, becoming a handicapper, payouts, or anything else — or tap “Talk to a human” any time.",
  },
];

const CANNED_FALLBACK =
  "I'm not totally sure about that one. I can help with subscriptions, how records are verified, trials, payments, becoming a handicapper, and payouts. If you'd like, tap “Talk to a human” and someone from our team can help.";

function cannedReply(message: string): string {
  const rule = CANNED_RULES.find((r) => r.test.test(message));
  return rule ? rule.answer : CANNED_FALLBACK;
}

export interface ChatTurn {
  author: "VISITOR" | "BOT" | "AGENT" | "SYSTEM";
  body: string;
}

/**
 * Produce the assistant's reply to the latest visitor message. Uses Claude when
 * ANTHROPIC_API_KEY is configured, otherwise the canned matcher. Never throws —
 * on any AI error it degrades to the canned answer so the widget keeps working.
 */
export async function botReply(history: ChatTurn[]): Promise<string> {
  const lastVisitor = [...history].reverse().find((t) => t.author === "VISITOR");
  const latest = lastVisitor?.body ?? "";

  if (!process.env.ANTHROPIC_API_KEY) {
    return cannedReply(latest);
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    // Only the recent turns are needed for a focused FAQ answer.
    const messages = history
      .filter((t) => t.author === "VISITOR" || t.author === "BOT")
      .slice(-10)
      .map((t) => ({
        role: t.author === "VISITOR" ? ("user" as const) : ("assistant" as const),
        content: t.body,
      }));
    if (messages.length === 0 || messages[0].role !== "user") {
      messages.unshift({ role: "user", content: latest || "Hello" });
    }

    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 600,
      system: `You are the friendly support assistant for Blitz.tips, embedded in a small chat widget on the website. Answer concisely (2-4 sentences), in a warm, helpful tone, using ONLY the facts below. If the question is outside this scope, or the visitor is upset or asks for a person, tell them they can tap "Talk to a human" to reach the team. Never invent prices, guarantees, or policies. Never give betting advice or predict outcomes.\n\n${KNOWLEDGE}`,
      messages,
    });

    const text = res.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || cannedReply(latest);
  } catch (err) {
    console.error("[chatbot] AI reply failed, using canned answer:", err);
    return cannedReply(latest);
  }
}
