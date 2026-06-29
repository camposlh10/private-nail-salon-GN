import { NextRequest, NextResponse } from "next/server";
import { hasDatabase } from "@/server/db";
import { createService, listServices, type ServiceInput } from "@/server/repository";
import { adminGuard } from "@/server/api-auth";
import { parseServiceInput } from "@/server/service-input";

export const runtime = "nodejs";

export async function GET() {
  const services = await listServices();

  return NextResponse.json({
    source: hasDatabase() ? "postgres" : "demo",
    services,
  });
}

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json()) as Partial<ServiceInput>;
  const parsed = parseServiceInput(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const service = await createService(parsed.input);

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create service." },
      { status: 500 },
    );
  }
}
