import { NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { testEmail } from "@/server/email";

export const runtime = "nodejs";

export async function POST() {
  const denied = await adminGuard();
  if (denied) return denied;

  const result = await testEmail();
  return NextResponse.json(result);
}
