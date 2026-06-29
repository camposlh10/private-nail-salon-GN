import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { getSettings, saveSettings, type AppSettings } from "@/server/settings";

export const runtime = "nodejs";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;

  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const patch = (await request.json()) as Partial<AppSettings>;

  try {
    const settings = await saveSettings(patch);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save settings." },
      { status: 500 },
    );
  }
}
