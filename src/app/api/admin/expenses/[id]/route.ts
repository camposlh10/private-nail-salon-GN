import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { deleteExpense } from "@/server/repository";

export const runtime = "nodejs";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;

  const { id } = await params;

  try {
    const result = await deleteExpense(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete expense.";
    return NextResponse.json({ error: message }, { status: message === "Expense not found." ? 404 : 500 });
  }
}
