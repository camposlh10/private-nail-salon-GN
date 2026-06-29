import { NextResponse } from "next/server";
import { getAdminOverview } from "@/server/repository";
import { adminGuard } from "@/server/api-auth";

export const runtime = "nodejs";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;

  const overview = await getAdminOverview();

  return NextResponse.json({ overview });
}
