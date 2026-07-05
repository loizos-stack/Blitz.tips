import { getSetting } from "@/lib/settings";
import { OddsQuotaCard, AnnouncementCard, AutoSettleCard } from "@/components/admin/system-tools";
import { guardAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  await guardAdminPage("system");
  const announcement = (await getSetting("announcement")) ?? "";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OddsQuotaCard />
      <AutoSettleCard />
      <div className="lg:col-span-2">
        <AnnouncementCard initial={announcement} />
      </div>
    </div>
  );
}
