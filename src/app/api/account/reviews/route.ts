import { NextRequest, NextResponse } from "next/server";
import { clientGuard } from "@/server/api-auth";
import { createClientReview } from "@/server/repository";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = await clientGuard();
  if ("response" in guard) return guard.response;

  const payload = (await request.json()) as { rating?: number; text?: string; appointmentId?: string };
  const rating = Number(payload.rating);

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Pick a rating from 1 to 5 stars." }, { status: 400 });
  }

  const review = await createClientReview({
    name: guard.session.name || guard.session.email,
    email: guard.session.email,
    rating,
    text: payload.text?.trim() ?? "",
    appointmentId: payload.appointmentId,
  });

  return NextResponse.json({ review }, { status: 201 });
}
