import { NextRequest, NextResponse } from "next/server";
import type { BookingRequest } from "@/types";
import { createBooking, listUpcomingAppointments } from "@/server/repository";
import { sendBookingEmails } from "@/server/email";
import { sendBookingSms } from "@/server/sms";

export const runtime = "nodejs";

export async function GET() {
  const appointments = await listUpcomingAppointments();

  return NextResponse.json({ appointments });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Partial<BookingRequest>;
  const hasServices = Boolean(payload.serviceIds?.length || payload.serviceId);
  const missing = ["date", "time", "name", "email"].filter((field) => !payload[field as keyof BookingRequest]);

  if (missing.length || !hasServices) {
    return NextResponse.json(
      { error: `Missing required fields: ${[...missing, ...(hasServices ? [] : ["serviceIds"])].join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const booking = await createBooking(payload as BookingRequest);
    const emailDelivery = await sendBookingEmails(booking).catch((error) => ({
      mode: "outbox" as const,
      customer: false,
      owner: false,
      errors: [error instanceof Error ? error.message : "Email delivery failed."],
    }));
    // Best-effort text message; a no-op unless Twilio is configured in Settings.
    await sendBookingSms(booking).catch(() => undefined);

    return NextResponse.json({ booking: { ...booking, emailDelivery } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create booking.";
    const status = message === "Unknown service." ? 400 : message.includes("no longer available") ? 409 : 500;

    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
