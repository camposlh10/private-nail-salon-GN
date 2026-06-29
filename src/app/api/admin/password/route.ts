import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { getSession, updateAccountPassword } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { password } = (await request.json()) as { password?: string };

  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  await updateAccountPassword(session.email, password);
  return NextResponse.json({ ok: true });
}
