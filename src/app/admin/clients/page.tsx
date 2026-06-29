import { AdminClientsDirectory } from "@/components/admin/AdminClientsDirectory";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { requireAdmin } from "@/server/auth";
import { listClientProfiles } from "@/server/repository";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  await requireAdmin();
  const [clients, settings] = await Promise.all([listClientProfiles(), getSettings()]);

  return (
    <>
      <AdminTopBar studioName={settings.branding.studioName} active="/admin/clients" />
      <AdminClientsDirectory clients={clients} />
    </>
  );
}
