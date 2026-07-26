import { PromoManager } from "@/components/admin/promo-manager";
import { guardAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  await guardAdminPage("promos");
  return <PromoManager />;
}
