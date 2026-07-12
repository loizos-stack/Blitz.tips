import { redirect } from "next/navigation";
import { ProfileImagesForm } from "@/components/profile-images-form";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperProfilePage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  return (
    <ProfileImagesForm
      avatarUrl={handicapper.avatarUrl}
      coverUrl={handicapper.coverUrl}
      displayName={handicapper.displayName}
    />
  );
}
