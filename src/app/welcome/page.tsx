import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SupercapperLogo } from "@/components/contest/supercapper-logo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose a dashboard",
  robots: { index: false, follow: false },
};

// Post-login landing resolver.
//
// Accounts with one home go straight to it — a chooser with a single option is
// just a click in the way. Resolved from the database rather than the session
// token, so it's correct even when the JWT is stale (e.g. right after a user
// becomes a handicapper). Admins → admin panel, handicappers → their dashboard,
// everyone else → the subscriber feed.
//
// Contest entrants are the exception: they have two genuinely separate homes,
// and guessing wrong drops them somewhere they have to navigate back out of.
export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      handicapper: { select: { id: true } },
      contestEntries: { select: { id: true }, take: 1 },
    },
  });

  // Whichever Blitz.tips dashboard this account normally lands on.
  const siteDashboard =
    user?.role === "ADMIN" ? "/admin" : user?.handicapper ? "/dashboard/handicapper" : "/dashboard";

  if (!user?.contestEntries.length) redirect(siteDashboard);

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold">Where to?</h1>
        <p className="mt-2 text-muted">You&apos;re in the contest, so you have two places to be.</p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-2">
        <Link
          href={siteDashboard}
          className="card group flex min-h-[18rem] flex-col items-center justify-center gap-5 p-10 text-center transition hover:border-accent sm:p-12"
        >
          {/* "Blitz.tips" has to be one flex child — as two, the gap lands
              between the word and the TLD and it reads "Blitz .tips". */}
          <span className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            <Image src="/logo-mark.svg" alt="" width={44} height={44} className="h-10 w-10 sm:h-11 sm:w-11" />
            <span>
              Blitz<span className="text-accent">.tips</span>
            </span>
          </span>
          <span className="text-base font-semibold uppercase tracking-[0.22em] text-muted">Dashboard</span>
          <span className="inline-flex items-center gap-1.5 text-base font-semibold text-accent">
            {user.role === "ADMIN"
              ? "Admin panel"
              : user.handicapper
                ? "Your picks and subscribers"
                : "Your feed and subscriptions"}
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
          </span>
        </Link>

        {/* Not the `card` class here: its own background wins over an arbitrary
            bg-* utility, which leaves the dark mark's white text on a white
            card — the "uper" disappears and it reads "capper". */}
        <Link
          href="/supercapper/dashboard"
          className="group flex min-h-[18rem] flex-col items-center justify-center gap-5 rounded-xl border border-white/10 bg-[#0b0f14] p-10 text-center text-white shadow-sm transition hover:border-[#eab308]/50 sm:p-12"
        >
          <SupercapperLogo withContest onDark className="text-3xl sm:text-4xl" />
          <span className="text-base font-semibold uppercase tracking-[0.22em] text-white/50">Dashboard</span>
          <span className="inline-flex items-center gap-1.5 text-base font-semibold text-[#eab308]">
            Your contest picks and rank
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
