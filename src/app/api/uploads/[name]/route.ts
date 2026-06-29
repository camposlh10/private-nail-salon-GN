import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { readUpload } from "@/server/uploads";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { name } = await params;
  const file = await readUpload(name);

  if (!file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
