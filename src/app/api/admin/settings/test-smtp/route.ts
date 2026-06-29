import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { testSmtp } from "@/server/email";
import { getSettings, type SmtpConfig } from "@/server/settings";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { smtp?: Partial<SmtpConfig> };
  const saved = (await getSettings()).integrations.smtp;
  const smtp: SmtpConfig = { ...saved, ...(body.smtp ?? {}) };

  const result = await testSmtp(smtp);
  return NextResponse.json(result);
}
