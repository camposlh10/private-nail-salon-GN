import { NextRequest, NextResponse } from "next/server";
import { getAvailability, setAvailability } from "@/server/repository";
import { adminGuard } from "@/server/api-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A date query param is required as YYYY-MM-DD." }, { status: 400 });
  }

  const duration = Number(request.nextUrl.searchParams.get("duration") ?? 30);
  const slots = await getAvailability(date, Number.isFinite(duration) ? duration : 30);

  return NextResponse.json({ date, slots });
}

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json()) as Partial<{ date: string; time: string; available: boolean }>;

  if (
    !payload.date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) ||
    !payload.time ||
    !/^\d{2}:\d{2}$/.test(payload.time) ||
    typeof payload.available !== "boolean"
  ) {
    return NextResponse.json({ error: "date, time, and available are required." }, { status: 400 });
  }

  try {
    const availability = await setAvailability(payload.date, payload.time, payload.available);
    return NextResponse.json({ availability });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update availability." },
      { status: 500 },
    );
  }
}
