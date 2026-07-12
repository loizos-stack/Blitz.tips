import { redirect } from "next/navigation";
import { ManagePlanCard } from "@/components/manage-plan-card";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperPlanPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  return (
    <ManagePlanCard
      plan={handicapper.plan}
      planStatus={handicapper.planStatus}
      planInterval={handicapper.planInterval}
      planCurrentPeriodEnd={handicapper.planCurrentPeriodEnd}
    />
  );
}
