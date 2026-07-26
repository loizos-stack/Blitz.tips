import { redirect } from "next/navigation";
import { ProfileImagesForm } from "@/components/profile-images-form";
import { ProfileSportsForm } from "@/components/profile-sports-form";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperProfilePage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  return (
    <div className="flex flex-col gap-4">
      <ProfileImagesForm
        avatarUrl={handicapper.avatarUrl}
        coverUrl={handicapper.coverUrl}
        displayName={handicapper.displayName}
      />
      <ProfileSportsForm initialSports={handicapper.sports} />
    </div>
  );
}
