import { NextRequest, NextResponse } from "next/server";
import { deleteService, updateService, type ServiceInput } from "@/server/repository";
import { adminGuard } from "@/server/api-auth";
import { parseServiceInput } from "@/server/service-input";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;
  const payload = (await request.json()) as Partial<ServiceInput>;
  const parsed = parseServiceInput(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const service = await updateService(id, parsed.input);

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
