import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { getAdminOverview } from "@/server/repository";
import { requireAdmin } from "@/server/auth";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const [overview, settings] = await Promise.all([getAdminOverview(), getSettings()]);

  return (
    <>
      <AdminTopBar studioName={settings.branding.studioName} active="/admin" />
      <AdminDashboard overview={overview} />
    </>
  );
}
