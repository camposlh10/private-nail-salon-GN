import { NextResponse } from "next/server";
import { getSession } from "@/server/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ account: null });
  }

  return NextResponse.json({
    account: { email: session.email, name: session.name, role: session.role },
  });
}
