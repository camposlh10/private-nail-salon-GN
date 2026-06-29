import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { setAppointmentAttendance } from "@/server/repository";
import type { AppointmentStatus } from "@/types";

export const runtime = "nodejs";

const allowed: AppointmentStatus[] = ["confirmed", "checked_in", "completed", "no_show"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;
  const payload = (await request.json()) as { status?: AppointmentStatus; tipCents?: number };

  if (!payload.status || !allowed.includes(payload.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    const appointment = await setAppointmentAttendance(id, payload.status, payload.tipCents ?? 0);
    return NextResponse.json({ appointment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update appointment.";
    return NextResponse.json({ error: message }, { status: message === "Appointment not found." ? 404 : 500 });
  }
}
