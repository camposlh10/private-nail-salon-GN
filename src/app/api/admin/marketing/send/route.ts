import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { listClientEmails } from "@/server/repository";
import { sendPromotion } from "@/server/email";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json()) as { audience?: "all" | "winback"; subject?: string; message?: string };
  const message = payload.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "Write a message to send." }, { status: 400 });
  }

  const audience = payload.audience === "winback" ? "winback" : "all";
  const recipients = await listClientEmails(audience);

  if (!recipients.length) {
    return NextResponse.json({ error: "No clients with an email match that audience yet." }, { status: 400 });
  }

  const subject = payload.subject?.trim() || "A note from your nail studio";
  const result = await sendPromotion(recipients, subject, message);

  return NextResponse.json({
    total: recipients.length,
    sent: result.sent,
    failed: result.failed,
    mode: result.mode,
  });
}
