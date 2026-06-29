import { NextRequest, NextResponse } from "next/server";
import { createManualAppointment, getAvailability, listAdminAppointments } from "@/server/repository";
import { adminGuard } from "@/server/api-auth";

export const runtime = "nodejs";

function todayValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const date = request.nextUrl.searchParams.get("date") ?? todayValue();
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 80);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }

  const [appointments, dayAppointments, slots] = await Promise.all([
    listAdminAppointments({ limit: Number.isFinite(limit) ? limit : 80 }),
    listAdminAppointments({ date, limit: 80, upcomingOnly: false }),
    getAvailability(date, 30),
  ]);

  return NextResponse.json({
    date,
    appointments,
    dayAppointments,
    slots,
  });
}

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json()) as Partial<{
    name: string;
    phone: string;
    email: string;
    serviceIds: string[];
    date: string;
    time: string;
    notes: string;
  }>;

  if (!payload.name?.trim()) {
    return NextResponse.json({ error: "A client name is required." }, { status: 400 });
  }
  if (!payload.serviceIds?.length) {
    return NextResponse.json({ error: "Pick at least one service." }, { status: 400 });
  }
  if (!payload.date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) || !payload.time || !/^\d{2}:\d{2}$/.test(payload.time)) {
    return NextResponse.json({ error: "A valid date and time are required." }, { status: 400 });
  }

  try {
    const appointment = await createManualAppointment({
      name: payload.name.trim(),
      phone: payload.phone,
      email: payload.email,
      serviceIds: payload.serviceIds,
      date: payload.date,
      time: payload.time,
      notes: payload.notes,
    });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add appointment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
