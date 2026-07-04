import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PickCard } from "@/components/pick-card";
import { ManageBillingButton } from "@/components/manage-billing-button";
import { VerifyEmailBanner } from "@/components/verify-email-banner";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/signin?callbackUrl=/dashboard");

  const [currentUser, handicapperProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true },
    }),
    prisma.handicapperProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    }),
  ]);

  const subscriptions = await prisma.subscription.findMany({
    where: { subscriberId: session.user.id, status: "ACTIVE" },
    include: { handicapper: true },
    orderBy: { createdAt: "desc" },
  });

  const handicapperIds = subscriptions.map((s) => s.handicapperId);

  const picks = handicapperIds.length
    ? await prisma.pick.findMany({
        where: { handicapperId: { in: handicapperIds } },
        include: { handicapper: true },
        orderBy: { eventStartsAt: "desc" },
        take: 50,
      })
    : [];

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-bold">Your feed</h1>
      <p className="mt-2 text-muted">Picks from the handicappers you follow.</p>

      {!currentUser?.emailVerified && (
        <div className="mt-6">
          <VerifyEmailBanner />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          {picks.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-muted">You&apos;re not subscribed to any handicappers yet.</p>
              <Link
                href="/leaderboard"
                className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Browse the leaderboard
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {picks.map((pick) => (
                <div key={pick.id}>
                  <Link
                    href={`/handicappers/${pick.handicapper.handle}`}
                    className="mb-1.5 inline-block text-sm font-medium text-muted hover:text-accent"
                  >
                    @{pick.handicapper.handle}
                  </Link>
                  <PickCard pick={pick} />
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="w-full lg:w-72">
          <div className="card p-5">
            <h2 className="font-semibold">Your subscriptions</h2>
            {subscriptions.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No active subscriptions.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {subscriptions.map((sub) => (
                  <li key={sub.id} className="flex items-center justify-between text-sm">
                    <Link href={`/handicappers/${sub.handicapper.handle}`} className="hover:text-accent">
                      @{sub.handicapper.handle}
                    </Link>
                    <span className="text-muted">
                      {sub.currentPeriodEnd
                        ? `renews ${sub.currentPeriodEnd.toLocaleDateString()}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {subscriptions.length > 0 && (
              <div className="mt-4">
                <ManageBillingButton />
              </div>
            )}
          </div>

          {!handicapperProfile && (
            <div className="card mt-4 border-accent/40 bg-accent/5 p-5">
              <h2 className="font-semibold">Start selling your own picks</h2>
              <p className="mt-2 text-sm text-muted">
                Got a winning record? Build a public track record and get paid by subscribers — keep
                using this account, no need to sign up again.
              </p>
              <Link
                href="/dashboard/handicapper"
                className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Become a handicapper
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
