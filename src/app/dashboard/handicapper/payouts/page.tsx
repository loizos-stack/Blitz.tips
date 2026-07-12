import { redirect } from "next/navigation";
import { ConnectOnboardingBanner, StripePayoutsCard } from "@/components/connect-onboarding-banner";
import { syncConnectStatus } from "@/lib/connect";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperPayoutsPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  // Self-healing Connect status: when an account exists but isn't marked ready,
  // check Stripe directly — covers a missing/misconfigured webhook and the
  // return from onboarding.
  const stripeReady =
    handicapper.stripeAccountId && !handicapper.stripeAccountReady
      ? await syncConnectStatus(handicapper)
      : handicapper.stripeAccountReady;

  return stripeReady ? (
    <StripePayoutsCard />
  ) : (
    <ConnectOnboardingBanner resume={Boolean(handicapper.stripeAccountId)} />
  );
}
