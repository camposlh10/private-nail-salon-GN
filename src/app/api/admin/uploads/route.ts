import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { saveUpload } from "@/server/uploads";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  try {
    const result = await saveUpload(file);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
