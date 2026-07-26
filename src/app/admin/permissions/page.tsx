import { guardAdminPage, GRANTABLE_PERMISSIONS } from "@/lib/permissions";
import { PermissionsManager } from "@/components/admin/permissions-manager";

export const dynamic = "force-dynamic";

export default async function AdminPermissionsPage() {
  await guardAdminPage("permissions");
  const permissions = GRANTABLE_PERMISSIONS.map((p) => ({
    key: p.key,
    label: p.label,
    description: p.description,
  }));
  return <PermissionsManager permissions={permissions} />;
}
