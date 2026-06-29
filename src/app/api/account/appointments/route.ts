import { NextResponse } from "next/server";
import { clientGuard } from "@/server/api-auth";
import { listClientAppointments } from "@/server/repository";

export const runtime = "nodejs";

export async function GET() {
  const guard = await clientGuard();
  if ("response" in guard) return guard.response;

  const appointments = await listClientAppointments(guard.session.email);

  return NextResponse.json({ appointments });
}
