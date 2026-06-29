import { NextResponse } from "next/server";
import { getPinterestData } from "@/server/pinterest";

export const runtime = "nodejs";

export async function GET() {
  const pinterest = await getPinterestData();

  return NextResponse.json({ pinterest });
}
