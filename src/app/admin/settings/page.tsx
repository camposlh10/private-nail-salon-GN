import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { AdminSettingsPanel } from "@/components/admin/AdminSettingsPanel";
import { requireAdmin } from "@/server/auth";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <>
      <AdminTopBar studioName={settings.branding.studioName} active="/admin/settings" />
      <AdminSettingsPanel initialSettings={settings} />
    </>
  );
}
