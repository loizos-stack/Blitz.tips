import { prisma } from "@/lib/prisma";
import { guardAdminPage } from "@/lib/permissions";
import { LogsViewer } from "@/components/admin/logs-viewer";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  await guardAdminPage("audit");

  // Distinct values power the filter dropdowns.
  const [actions, targetTypes] = await Promise.all([
    prisma.adminAuditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.adminAuditLog.findMany({ distinct: ["targetType"], select: { targetType: true }, orderBy: { targetType: "asc" } }),
  ]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Activity logs</h2>
        <p className="text-sm text-muted">
          Every recorded change on the site — search and filter to audit what happened, who did it, and when.
        </p>
      </div>
      <LogsViewer
        actions={actions.map((a) => a.action)}
        targetTypes={targetTypes.map((t) => t.targetType)}
      />
    </div>
  );
}
