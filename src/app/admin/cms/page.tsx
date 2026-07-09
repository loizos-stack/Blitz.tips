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

  const [handicapperSaved, subscriberSaved] = await Promise.all([
    getSetting(DASHBOARD_ORDER_SETTING.handicapper),
    getSetting(DASHBOARD_ORDER_SETTING.subscriber),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Dashboard layout</h2>
        <p className="mt-1 text-sm text-muted">
          Drag-free reordering of the sections handicappers and customers see on their dashboards.
          Changes take effect immediately for everyone.
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
      />
    </div>
  );
}
