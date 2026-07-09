import { guardAdminPage } from "@/lib/permissions";
import { getSetting } from "@/lib/settings";
import { CmsEditor } from "@/components/admin/cms-editor";
import {
  DASHBOARD_ORDER_SETTING,
  sectionsFor,
  resolveSectionOrder,
} from "@/lib/dashboard-sections";

export const dynamic = "force-dynamic";

export default async function AdminCmsPage() {
  await guardAdminPage("cms");

  const [handicapperSaved, subscriberSaved, profileSaved] = await Promise.all([
    getSetting(DASHBOARD_ORDER_SETTING.handicapper),
    getSetting(DASHBOARD_ORDER_SETTING.subscriber),
    getSetting(DASHBOARD_ORDER_SETTING.profile),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Page layout</h2>
        <p className="mt-1 text-sm text-muted">
          Drag-free reordering of the sections on the handicapper and customer dashboards and the
          public handicapper profile page. Changes take effect immediately for everyone.
        </p>
      </div>

      <CmsEditor
        handicapper={{
          sections: sectionsFor("handicapper"),
          order: resolveSectionOrder("handicapper", handicapperSaved),
        }}
        subscriber={{
          sections: sectionsFor("subscriber"),
          order: resolveSectionOrder("subscriber", subscriberSaved),
        }}
        profile={{
          sections: sectionsFor("profile"),
          order: resolveSectionOrder("profile", profileSaved),
        }}
      />
    </div>
  );
}
