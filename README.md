# Blitz.tips

A multi-handicapper sports betting marketplace, in the spirit of [dubclub.win](https://dubclub.win).
Handicappers post picks before events happen, results are settled after, and win rate / units /
ROI are computed automatically from the full history — nothing can be edited after the fact.
Subscribers pay a handicapper's own monthly price (via Stripe) to unlock their premium picks.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Postgres** + **Prisma** for data
- **Auth.js (NextAuth v5)** — email/password (Credentials) + Google OAuth
- **Stripe Connect** (Express accounts) for handicapper payouts, **Stripe Billing** for
  subscriptions, split via `application_fee_percent`

## Core concepts

- `User` — has a `role` of `SUBSCRIBER`, `HANDICAPPER`, or `ADMIN`.
- `HandicapperProfile` — a handicapper's public page: handle, bio, sports, monthly price, and
  their Stripe Connect account/product/price.
- `Pick` — a single wager: sport, matchup, bet type, selection, American odds, units risked,
  and a `result` that starts `PENDING` and is settled to `WIN` / `LOSS` / `PUSH` / `VOID`.
- `Subscription` — links a subscriber to a handicapper via a Stripe subscription.

Win rate, net units, and ROI are derived on the fly from every `Pick` (see `src/lib/odds.ts`) —
there's no separate "stats" table to keep in sync.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

- `DATABASE_URL` / `DIRECT_URL` — Postgres connection strings. Locally these can be identical.
  On a pooled host (Neon, Supabase, RDS Proxy, etc.), **`DATABASE_URL` must be the pooled
  connection** (what the running app uses — serverless functions open many concurrent
  connections, and without pooling you exhaust Postgres's connection limit and requests hang
  instead of failing) and **`DIRECT_URL` must be the direct/non-pooled connection** (used only
  by `prisma migrate deploy`). On Neon specifically: the "pooled connection" toggle in the
  connection string box gives you the `DATABASE_URL` value (host has a `-pooler` suffix); turn
  it off for the `DIRECT_URL` value.
- `AUTH_SECRET` — generate with `npx auth secret`.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — from the
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (optional; email/password
  login works without it).
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — from the
  [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys). Use test-mode keys locally.
  Stripe Connect must be enabled on your Stripe account for the payout/onboarding flow.
- `THE_ODDS_API_KEY` — from [the-odds-api.com](https://the-odds-api.com) (optional). Powers the
  "From schedule" tab in the handicapper pick form: upcoming games with live moneyline/spread/total
  odds that autofill the pick. Without a key the form falls back to manual entry. Responses are
  cached for an hour per sport to stay inside the free tier's 500 credits/month (a request costs
  3 credits: `h2h,spreads,totals` × 1 region).

### 3. Set up the database

```bash
npx prisma migrate dev
npm run db:seed   # optional: creates 4 demo handicappers + a demo subscriber
```

Seeded logins (password `password123` for all): `sharpsteve@blitz.tips`, `puckqueen@blitz.tips`,
`diamondking@blitz.tips`, `roughrider@blitz.tips` (handicappers), and `subscriber@blitz.tips`
(subscribed to `sharpsteve`). Seeded handicappers don't have Stripe Connect accounts, so their
"Subscribe" button stays disabled until you complete Connect onboarding for them.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Stripe webhooks (local dev)

Forward Stripe events to your local server with the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Project layout

```
prisma/schema.prisma          Data model
src/auth.ts                   NextAuth (Auth.js) config
src/lib/                      Prisma client, odds/stats math, Stripe client, zod schemas
src/app/                      Routes (marketing pages, dashboards, API route handlers)
src/app/api/stripe/           Connect onboarding, checkout, billing portal, webhook
src/components/               Shared UI (nav, pick cards, forms, etc.)
```

## Scripts

| Command                | Description                          |
| ----------------------- | ------------------------------------ |
| `npm run dev`            | Start the dev server                 |
| `npm run build`          | Production build                     |
| `npm run lint`           | Lint the codebase                    |
| `npm run prisma:migrate` | Run Prisma migrations in dev         |
| `npm run db:seed`        | Seed demo data                       |
