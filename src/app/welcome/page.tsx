import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Post-login landing resolver: sends each account straight to its own dashboard.
// Resolves from the database rather than the session token, so it's correct even
// when the JWT is stale — e.g. right after a user becomes a handicapper, before
// their token refreshes. Admins → admin panel, handicappers → their dashboard,
// everyone else → the subscriber feed.
export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, handicapper: { select: { id: true } } },
  });

  if (user?.role === "ADMIN") redirect("/admin");
  if (user?.handicapper) redirect("/dashboard/handicapper");
  redirect("/dashboard");
}
