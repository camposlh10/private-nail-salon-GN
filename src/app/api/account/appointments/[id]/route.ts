import { NextRequest, NextResponse } from "next/server";
import { clientGuard } from "@/server/api-auth";
import { cancelClientAppointment, getAdminAppointment } from "@/server/repository";
import { sendOwnerAppointmentChange } from "@/server/email";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await clientGuard();
  if ("response" in guard) return guard.response;

  const { id } = await params;

  try {
    const details = await getAdminAppointment(id);
    const result = await cancelClientAppointment(guard.session.email, id);
    if (details) {
      await sendOwnerAppointmentChange(details, "cancelled").catch(() => undefined);
    }
    return NextResponse.json({ appointment: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel appointment.";
    return NextResponse.json({ error: message }, { status: message === "Appointment not found." ? 404 : 500 });
  }
}
