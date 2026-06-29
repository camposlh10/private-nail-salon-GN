import { NextRequest, NextResponse } from "next/server";
import { createBookingCheckout } from "@/server/payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { bookingId } = (await request.json()) as { bookingId?: string };

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required." }, { status: 400 });
  }

  const result = await createBookingCheckout(bookingId, request.nextUrl.origin);

  if ("url" in result) {
    return NextResponse.json({ url: result.url });
  }

  return NextResponse.json({ error: result.error }, { status: result.configured ? 502 : 409 });
}
