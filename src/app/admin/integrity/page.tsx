import { guardAdminPage } from "@/lib/permissions";
import { getIntegrityOverview } from "@/lib/integrity";
import { IntegrityViewer } from "@/components/admin/integrity-viewer";

export const dynamic = "force-dynamic";

export default async function AdminIntegrityPage() {
  await guardAdminPage("integrity");
  const overview = await getIntegrityOverview();
  return <IntegrityViewer overview={overview} />;
}
