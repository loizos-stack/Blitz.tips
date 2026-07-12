import { redirect } from "next/navigation";
import { PricingPackagesCard } from "@/components/pricing-packages-card";
import { PayoutWalletsCard } from "@/components/payout-wallets-card";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperPricingPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  return (
    <div className="flex flex-col gap-4">
      <PricingPackagesCard
        weeklyPriceCents={handicapper.weeklyPriceCents}
        monthlyPriceCents={handicapper.monthlyPriceCents}
        annualPriceCents={handicapper.annualPriceCents}
        subscriptionTrialDays={handicapper.subscriptionTrialDays}
        priceCurrency={handicapper.priceCurrency}
      />
      <PayoutWalletsCard
        payoutEthAddress={handicapper.payoutEthAddress}
        payoutBtcAddress={handicapper.payoutBtcAddress}
      />
    </div>
  );
}
