import { NextRequest, NextResponse } from "next/server";
import { handleWebhook } from "@/server/payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const result = await handleWebhook(rawBody, signature);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}
