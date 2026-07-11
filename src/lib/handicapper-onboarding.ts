import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { HandicapperProfile } from "@prisma/client";

// Ordered labels for the handicapper registration wizard stepper.
export const HANDICAPPER_WIZARD_STEPS = [
  "Profile",
  "Pricing",
  "Payments",
  "Socials",
  "Notifications",
  "Plan",
];

/** Auth + verified email; returns the user id or redirects into the flow. */
export async function requireVerifiedUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  if (!user?.emailVerified) redirect("/onboarding/verify?as=handicapper");
  return session.user.id;
}

/**
 * Gate for the post-profile wizard steps: requires a verified user with a
 * handicapper profile, sending them back to the profile step if it's missing.
 */
export async function requireOnboardingProfile(): Promise<HandicapperProfile> {
  const userId = await requireVerifiedUser();
  const profile = await prisma.handicapperProfile.findUnique({ where: { userId } });
  if (!profile) redirect("/onboarding/handicapper/profile");
  return profile;
}
