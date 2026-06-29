import { NextRequest, NextResponse } from "next/server";
import { cancelAdminAppointment, getAdminAppointment, rescheduleAdminAppointment } from "@/server/repository";
import { adminGuard } from "@/server/api-auth";
import { sendOwnerAppointmentChange } from "@/server/email";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;
  const payload = (await request.json()) as Partial<{ date: string; time: string }>;

  if (!payload.date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) || !payload.time || !/^\d{2}:\d{2}$/.test(payload.time)) {
    return NextResponse.json({ error: "date and time are required." }, { status: 400 });
  }

  try {
    const appointment = await rescheduleAdminAppointment(id, payload.date, payload.time);
    await sendOwnerAppointmentChange(appointment, "rescheduled").catch(() => undefined);

    return NextResponse.json({ appointment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reschedule appointment.";

    return NextResponse.json(
      { error: message },
      { status: message === "Appointment not found." ? 404 : 409 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;

  try {
    const details = await getAdminAppointment(id);
    const appointment = await cancelAdminAppointment(id);
    if (details) {
      await sendOwnerAppointmentChange(details, "cancelled").catch(() => undefined);
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove appointment.";

    return NextResponse.json(
      { error: message },
      { status: message === "Appointment not found." ? 404 : 500 },
    );
  }
}
