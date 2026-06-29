import { NextResponse } from "next/server";
import { getSession, type Session } from "./auth";

/**
 * Guard for admin-only route handlers. Returns a 401/403 response to return
 * early, or `null` when the caller is an authenticated admin.
 */
export async function adminGuard(): Promise<NextResponse | null> {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  return null;
}

/** Guard for client-portal route handlers. Returns the session or a 401 response. */
export async function clientGuard(): Promise<{ session: Session } | { response: NextResponse }> {
  const session = await getSession();

  if (!session) {
    return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }

  return { session };
}
