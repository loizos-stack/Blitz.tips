import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConnectOnboardingBanner, StripePayoutsCard } from "@/components/connect-onboarding-banner";
import { PayoutWalletsCard } from "@/components/payout-wallets-card";
import { syncConnectStatus } from "@/lib/connect";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperPayoutsPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  // Whenever an account is on file, re-check it against Stripe on load. This
  // covers a missing/misconfigured account.updated webhook, the return from
  // onboarding, and clears a stale account that no longer exists for the
  // current key (e.g. a test-mode account after switching to live).
  const stripeReady = handicapper.stripeAccountId
    ? await syncConnectStatus(handicapper)
    : false;

  // syncConnectStatus may have just cleared a dead account id, so read the
  // current value to decide between "resume" and "set up" copy.
  const current = await prisma.handicapperProfile.findUnique({
    where: { id: handicapper.id },
    select: { stripeAccountId: true },
  });

  return (
    <div className="flex flex-col gap-4">
      {stripeReady ? (
        <StripePayoutsCard />
      ) : (
        <ConnectOnboardingBanner resume={Boolean(current?.stripeAccountId)} />
      )}
      <PayoutWalletsCard
        payoutEthAddress={handicapper.payoutEthAddress}
        payoutBtcAddress={handicapper.payoutBtcAddress}
      />
    </div>
  );
}
