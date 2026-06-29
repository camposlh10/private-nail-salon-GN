import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { listAdminAppointments } from "@/server/repository";

export const runtime = "nodejs";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const month = request.nextUrl.searchParams.get("month") ?? currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM." }, { status: 400 });
  }

  const appointments = await listAdminAppointments({ month });
  return NextResponse.json({ month, appointments });
}
