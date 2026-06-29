import { NextResponse } from "next/server";
import { getInstagramData } from "@/server/instagram";

export const runtime = "nodejs";

export async function GET() {
  const instagram = await getInstagramData();

  return NextResponse.json({ instagram });
}
