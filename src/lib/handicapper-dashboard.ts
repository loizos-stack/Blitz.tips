import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Shared loader for the per-section handicapper dashboard pages. Each page pulls
// the full profile (with picks + reviews) and computes the slice it needs.
// Redirects to sign-in when signed out; returns handicapper: null when the
// signed-in user hasn't created a profile yet (the Overview page renders the
// "become a handicapper" form in that case; other pages bounce to Overview).
export async function loadDashboardHandicapper() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/dashboard/handicapper");

  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      picks: { orderBy: { eventStartsAt: "desc" } },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, username: true, image: true } } },
      },
    },
  });

  return { session, handicapper };
}

export type DashboardHandicapper = NonNullable<
  Awaited<ReturnType<typeof loadDashboardHandicapper>>["handicapper"]
>;
