import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HandicapperDashboardNav } from "@/components/dashboard/handicapper-nav";
import { VerifyEmailBanner } from "@/components/verify-email-banner";

export const metadata: Metadata = { title: "Handicapper dashboard" };
export const dynamic = "force-dynamic";

export default async function HandicapperDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/dashboard/handicapper");

  const [handicapper, user] = await Promise.all([
    prisma.handicapperProfile.findUnique({
      where: { userId: session.user.id },
      select: { handle: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { emailVerified: true } }),
  ]);

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Your dashboard</h1>
          {handicapper ? (
            <p className="mt-1 text-muted">
              Public profile:{" "}
              <Link href={`/handicappers/${handicapper.handle}`} className="text-accent hover:underline">
                blitz.tips/handicappers/{handicapper.handle}
              </Link>
            </p>
          ) : (
            <p className="mt-1 text-muted">Set up your handicapper profile to get started.</p>
          )}
        </div>
      </div>

      {!user?.emailVerified && (
        <div className="mt-6">
          <VerifyEmailBanner />
        </div>
      )}

      {/* The section nav only makes sense once a profile exists. */}
      {handicapper && (
        <div className="mt-6">
          <HandicapperDashboardNav />
        </div>
      )}

      <div className="mt-8">{children}</div>
    </div>
  );
}
