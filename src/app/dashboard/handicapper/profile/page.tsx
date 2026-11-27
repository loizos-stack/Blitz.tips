import { redirect } from "next/navigation";
import { ProfileImagesForm } from "@/components/profile-images-form";
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
      {/* There used to be a sports editor here. Said out loud rather than
          silently removed: a setting that disappears without explanation reads
          as a bug, and this one changed how the profile behaves. */}
      <div className="card p-5">
        <h2 className="font-semibold">Sports</h2>
        <p className="mt-1 text-sm text-muted">
          These aren&apos;t set by hand any more. Your profile shows a sport as soon as you post a
          tip in it, and that is also what puts you in the sport filters — so the badges on your
          card are always your actual record, never a list of intentions.
        </p>
      </div>
    </div>
  );
}
