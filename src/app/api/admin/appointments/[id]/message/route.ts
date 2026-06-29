import { NextRequest, NextResponse } from "next/server";
import type { BookingConfirmation } from "@/types";
import { sendAppointmentMessage, type AppointmentMessageKind } from "@/server/email";
import { sendAppointmentMessageSms } from "@/server/sms";
import { createAdminNotification, getAdminAppointment } from "@/server/repository";
import { getStudioConfig } from "@/server/studio";
import { adminGuard } from "@/server/api-auth";

export const runtime = "nodejs";

const messageKinds: AppointmentMessageKind[] = ["reminder", "cancellation", "custom"];

async function toBookingConfirmation(appointment: NonNullable<Awaited<ReturnType<typeof getAdminAppointment>>>): Promise<BookingConfirmation> {
  const studio = await getStudioConfig();

  return {
    id: appointment.id,
    serviceName: appointment.serviceName,
    startAt: appointment.startAt,
    durationMinutes: appointment.durationMinutes,
    priceCents: appointment.priceCents,
    clientName: appointment.clientName,
    clientEmail: appointment.clientEmail,
    clientPhone: appointment.clientPhone,
    notes: appointment.notes,
    locationName: studio.locationName,
    locationAddress: studio.address,
    mapsUrl: studio.mapsUrl,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;
  const payload = (await request.json()) as Partial<{ kind: AppointmentMessageKind; message: string }>;
  const kind = payload.kind;

  if (!kind || !messageKinds.includes(kind)) {
    return NextResponse.json({ error: "kind must be reminder, cancellation, or custom." }, { status: 400 });
  }

  if (kind === "custom" && !payload.message?.trim()) {
    return NextResponse.json({ error: "A custom message is required." }, { status: 400 });
  }

  const appointment = await getAdminAppointment(id);

  if (!appointment || appointment.source === "demo") {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  try {
    const booking = await toBookingConfirmation(appointment);
    const emailDelivery = await sendAppointmentMessage(booking, kind, payload.message);
    await sendAppointmentMessageSms(booking, kind, payload.message).catch(() => undefined);
    await createAdminNotification({
      type: "email",
      title: `${kind[0].toUpperCase()}${kind.slice(1)} message sent`,
      body: `${appointment.clientName} was sent a ${kind} message for ${appointment.serviceName}.`,
      appointmentId: appointment.id,
    });

    return NextResponse.json({ emailDelivery });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send message." },
      { status: 500 },
    );
  }
}
