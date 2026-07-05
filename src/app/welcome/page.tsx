import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// Post-login landing resolver: sends each account straight to its own dashboard.
// Admins → the admin panel, handicappers → their handicapper dashboard, everyone
// else → the subscriber feed. Runs server-side so it sees the just-set session.
export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.handicapperHandle) redirect("/dashboard/handicapper");
  redirect("/dashboard");
}
