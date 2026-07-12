import { redirect } from "next/navigation";
import { SocialsForm } from "@/components/socials-form";
import { TestimonialsForm } from "@/components/testimonials-form";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperCommunityPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SocialsForm
        initial={{
          xUrl: handicapper.xUrl,
          instagramUrl: handicapper.instagramUrl,
          youtubeUrl: handicapper.youtubeUrl,
          tiktokUrl: handicapper.tiktokUrl,
          discordUrl: handicapper.discordUrl,
          telegramUrl: handicapper.telegramUrl,
          websiteUrl: handicapper.websiteUrl,
        }}
      />
      <TestimonialsForm
        initial={handicapper.testimonials.map((t) => ({ id: t.id, author: t.author, quote: t.quote }))}
      />
    </div>
  );
}
