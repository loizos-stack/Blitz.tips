import { redirect } from "next/navigation";
import { ConnectOnboardingBanner, StripePayoutsCard } from "@/components/connect-onboarding-banner";
import { PayoutWalletsCard } from "@/components/payout-wallets-card";
import { connectBannerState } from "@/lib/connect";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";
import { handicapperBalance } from "@/lib/handicapper-balance";
import { ManualPayoutCard } from "@/components/manual-payout-card";

export const dynamic = "force-dynamic";

export default async function HandicapperPayoutsPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  // Whenever an account is on file this re-checks it against Stripe, which
  // covers a missing/misconfigured account.updated webhook, the return from
  // onboarding, and clears a stale account that no longer exists for the
  // current key (e.g. a test-mode account after switching to live). It also
  // decides which country the picker starts on.
  const connect = await connectBannerState(handicapper);

  // What the platform is holding for them. Shown above the Connect banner
  // when there is anything outstanding, because "you are owed 180.00" is more
  // useful to someone opening this page than "connect your account" — and
  // until they connect, this page was the one place that said nothing about
  // the money their subscribers had already paid.
  const balance = await handicapperBalance(handicapper.id);

  return (
    <div className="flex flex-col gap-4">
      <ManualPayoutCard
        balance={balance}
        currency={handicapper.priceCurrency}
        connected={connect.ready}
      />
      {connect.ready ? (
        <StripePayoutsCard />
      ) : (
        <ConnectOnboardingBanner
          resume={connect.resume}
          defaultCountry={connect.defaultCountry}
          unsupportedCountry={connect.unsupportedCountry}
        />
      )}
      <PayoutWalletsCard
        payoutEthAddress={handicapper.payoutEthAddress}
        payoutBtcAddress={handicapper.payoutBtcAddress}
      />
    </div>
  );
}
