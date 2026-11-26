import { Prisma, PrismaClient } from "@prisma/client";

/**
 * The Prisma client, with one retry wrapped around it.
 *
 * The retry is not defensive padding. Neon scales the compute to zero after a
 * few minutes of no traffic, and the first query to arrive afterwards does not
 * wait for the instance to wake: it comes straight back as P1001, "Can't reach
 * database server". Rendering a page that happens to be the first request in a
 * quiet hour therefore throws, and the visitor sees "A server error occurred"
 * on a site that works perfectly on reload. That was observed directly on
 * 2026-11-20: /leaderboard returned a 500 with P1001 and the identical request
 * succeeded immediately afterwards.
 *
 * This covers a wake-up, and only a wake-up. It is NOT an answer to the
 * database being unreachable for minutes at a time — two retries buy about a
 * second and a half, and nothing here would have saved the 2026-11-26 outage,
 * where build machines and lambdas alike were refused for a quarter of an hour.
 * Those two failures look the same in the logs and are not the same problem;
 * the warnings below are how you tell them apart, because a wake-up logs one
 * retry and recovers while an outage logs every attempt and still fails.
 *
 * Only the errors that mean the query never reached Postgres are retried:
 *
 *   - PrismaClientInitializationError — the connection itself never opened
 *   - P1001 — the server could not be reached
 *   - P1002 — it was reached but the connection timed out
 *
 * Deliberately NOT P1017 ("server has closed the connection"). That one can
 * arrive after a statement was sent, so a retry could run a write twice. Every
 * code here fails before anything is sent, which is what makes retrying one
 * safe for a create as well as a read.
 *
 * Two retries, ~300ms then ~1.2s, because a Neon wake is typically under two
 * seconds. If the database is genuinely down, this adds 1.5s to an error that
 * was going to happen anyway; it does not turn an outage into a hang.
 *
 * Note that `$transaction` is not covered — Prisma's query extensions wrap
 * operations, not the transaction wrapper around them. That is the right place
 * to stop: the only transactions here are in the player sync, which runs from
 * cron and can be re-run, and retrying a half-applied transaction is a
 * different and worse problem than the one this solves.
 */

const RETRYABLE_CODES = new Set(["P1001", "P1002"]);

function isUnreachable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_CODES.has(error.code);
  }
  return false;
}

const RETRY_DELAYS_MS = [300, 1200];

function base() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function withColdStartRetry(client: PrismaClient) {
  return client.$extends({
    name: "neon-cold-start-retry",
    query: {
      async $allOperations({ args, query, model, operation }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            if (attempt >= RETRY_DELAYS_MS.length || !isUnreachable(error)) throw error;
            // Logged, not silent: a retry that quietly papers over a database
            // that is actually unhealthy is how you stop noticing.
            console.warn(
              `[prisma] ${model ?? "raw"}.${operation} could not reach the database; retrying in ${RETRY_DELAYS_MS[attempt]}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
          }
        }
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof withColdStartRetry>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedClient | undefined;
};

export const prisma: ExtendedClient = globalForPrisma.prisma ?? withColdStartRetry(base());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
