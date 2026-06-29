import { NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { hasDatabase, isDbReady } from "@/server/db";
import { applySchema } from "@/server/migrate";

export const runtime = "nodejs";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;

  return NextResponse.json({
    configured: hasDatabase(),
    ready: await isDbReady(),
  });
}

export async function POST() {
  const denied = await adminGuard();
  if (denied) return denied;

  const result = await applySchema();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
