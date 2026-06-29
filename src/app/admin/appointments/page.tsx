import { AdminAppointmentsPanel } from "@/components/AdminAppointmentsPanel";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { getAvailability, listAdminAppointments } from "@/server/repository";
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

export default async function AdminAppointmentsPage() {
  await requireAdmin();
  const selectedDate = todayValue();
  const [appointments, dayAppointments, slots, settings] = await Promise.all([
    listAdminAppointments({ limit: 80 }),
    listAdminAppointments({ date: selectedDate, limit: 80, upcomingOnly: false }),
    getAvailability(selectedDate, 30),
    getSettings(),
  ]);

  return (
    <>
      <AdminTopBar studioName={settings.branding.studioName} active="/admin/appointments" />
      <AdminAppointmentsPanel
        initialDate={selectedDate}
        initialAppointments={appointments}
        initialDayAppointments={dayAppointments}
        initialSlots={slots}
      />
    </>
  );
}
