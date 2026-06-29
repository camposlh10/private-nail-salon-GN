import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { RevenuePanel } from "@/components/admin/RevenuePanel";
import { requireAdmin } from "@/server/auth";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

function todayValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function AdminRevenuePage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <>
      <AdminTopBar studioName={settings.branding.studioName} active="/admin/revenue" />
      <RevenuePanel initialDate={todayValue()} />
    </>
  );
}
