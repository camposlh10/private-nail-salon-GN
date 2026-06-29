import { NextRequest, NextResponse } from "next/server";
import { deleteService, updateService, type ServiceInput } from "@/server/repository";
import { adminGuard } from "@/server/api-auth";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;
  const payload = (await request.json()) as Partial<ServiceInput>;
  const missing = ["name", "description", "durationMinutes", "priceCents", "category", "imageUrl"].filter(
    (field) => payload[field as keyof ServiceInput] === undefined || payload[field as keyof ServiceInput] === "",
  );

  if (missing.length) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
  }

  try {
    const service = await updateService(id, {
      name: payload.name!,
      description: payload.description!,
      durationMinutes: Number(payload.durationMinutes),
      priceCents: Number(payload.priceCents),
      category: payload.category!,
      imageUrl: payload.imageUrl!,
      popular: Boolean(payload.popular),
      addon: Boolean(payload.addon),
    });

    return NextResponse.json({ service });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update service.";

    return NextResponse.json(
      { error: message },
      { status: message === "Service not found." ? 404 : 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;

  try {
    const service = await deleteService(id);

    return NextResponse.json({ service });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete service.";

    return NextResponse.json(
      { error: message },
      { status: message === "Service not found." ? 404 : 500 },
    );
  }
}
