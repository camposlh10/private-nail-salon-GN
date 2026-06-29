import { NextRequest, NextResponse } from "next/server";
import { createAccount, startSession } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Partial<{ email: string; name: string; phone: string; password: string }>;
  const email = payload.email?.trim();
  const name = payload.name?.trim();
  const password = payload.password ?? "";

  if (!email || !name || !password) {
    return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const account = await createAccount({ email, name, phone: payload.phone, password, role: "client" });
    await startSession(account);

    return NextResponse.json(
      { account: { email: account.email, name: account.name, role: account.role } },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    return NextResponse.json({ error: message }, { status: message.includes("already exists") ? 409 : 500 });
  }
}
