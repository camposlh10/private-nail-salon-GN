import { ClientPortal } from "@/components/account/ClientPortal";
import { requireClient } from "@/server/auth";
import { listClientAppointments } from "@/server/repository";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireClient();
  const appointments = await listClientAppointments(session.email);

  return (
    <main>
      <ClientPortal name={session.name || session.email} initialAppointments={appointments} bookingUrl="/#book" />
    </main>
  );
}
