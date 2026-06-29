import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/server/api-auth";
import { createExpense, listExpenses } from "@/server/repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const date = request.nextUrl.searchParams.get("date") ?? undefined;
  const expenses = await listExpenses(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined);
  return NextResponse.json({ expenses });
}

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json()) as Partial<{
    date: string;
    description: string;
    category: string;
    amountCents: number;
    receiptUrl: string;
  }>;

  if (!payload.date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }
  if (!payload.amountCents || payload.amountCents <= 0) {
    return NextResponse.json({ error: "An amount is required." }, { status: 400 });
  }

  const expense = await createExpense({
    date: payload.date,
    description: payload.description?.trim() || "Expense",
    category: payload.category?.trim() || "supplies",
    amountCents: payload.amountCents,
    receiptUrl: payload.receiptUrl,
  });

  return NextResponse.json({ expense }, { status: 201 });
}
