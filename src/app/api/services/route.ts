import { NextRequest, NextResponse } from "next/server";
import { hasDatabase } from "@/server/db";
import { createService, listServices, type ServiceInput } from "@/server/repository";
import { adminGuard } from "@/server/api-auth";

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
  const missing = ["name", "description", "durationMinutes", "priceCents", "category", "imageUrl"].filter(
    (field) => payload[field as keyof ServiceInput] === undefined || payload[field as keyof ServiceInput] === "",
  );

  if (missing.length) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
  }

  try {
    const service = await createService({
      name: payload.name!,
      description: payload.description!,
      durationMinutes: Number(payload.durationMinutes),
      priceCents: Number(payload.priceCents),
      category: payload.category!,
      imageUrl: payload.imageUrl!,
      popular: Boolean(payload.popular),
      addon: Boolean(payload.addon),
    });

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create service." },
      { status: 500 },
    );
  }
}
