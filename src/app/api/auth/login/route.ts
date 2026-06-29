import { NextRequest, NextResponse } from "next/server";
import { authenticate, ensureAdminSeed, startSession } from "@/server/auth";
import { getSettings } from "@/server/settings";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Partial<{ email: string; password: string; intent: "admin" | "client" }>;
  const email = payload.email?.trim();
  const password = payload.password ?? "";
  const intent = payload.intent ?? "client";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  // Make sure the admin account exists before an admin attempts to sign in.
  if (intent === "admin") {
    const settings = await getSettings();
    await ensureAdminSeed(settings.location.ownerEmail);
  }

  const account = await authenticate(email, password);

  if (!account) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  if (intent === "admin" && account.role !== "admin") {
    return NextResponse.json({ error: "This account is not an admin." }, { status: 403 });
  }

  await startSession(account);

  return NextResponse.json({
    account: { email: account.email, name: account.name, role: account.role },
  });
}
