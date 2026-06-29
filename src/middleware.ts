import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/session-constants";

/**
 * Lightweight redirect guard. It only checks for the presence of a session
 * cookie (edge-safe, no crypto) so unauthenticated visitors are bounced to the
 * right login page. Cryptographic verification of the token happens in the page
 * guards (`requireAdmin` / `requireClient`) which run on the Node.js runtime.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/account") && pathname !== "/account/login" && pathname !== "/account/register") {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/account/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
