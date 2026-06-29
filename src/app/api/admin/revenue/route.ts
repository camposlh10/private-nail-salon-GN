import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { getRevenueSummary, listAdminAppointments, listExpenses } from "@/server/repository";

export const runtime = "nodejs";

function todayValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const date = request.nextUrl.searchParams.get("date") ?? todayValue();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }

  const [summary, appointments, expenses] = await Promise.all([
    getRevenueSummary(date),
    listAdminAppointments({ date, limit: 200, upcomingOnly: false }),
    listExpenses(date),
  ]);

  return NextResponse.json({ date, summary, appointments, expenses });
}
