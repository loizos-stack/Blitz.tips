import { redirect } from "next/navigation";
import { PricingPackagesCard } from "@/components/pricing-packages-card";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperPricingPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  return (
    <PricingPackagesCard
      weeklyPriceCents={handicapper.weeklyPriceCents}
      monthlyPriceCents={handicapper.monthlyPriceCents}
      annualPriceCents={handicapper.annualPriceCents}
      subscriptionTrialDays={handicapper.subscriptionTrialDays}
      priceCurrency={handicapper.priceCurrency}
    />
  );
}
