import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Early redirect for signed-out visitors to /admin. This is a convenience, not the
 * security boundary: getCurrentAdmin() re-verifies in every admin page and action.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Sign-in and one-time invite/reset links work without a session.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/set-password/")) return NextResponse.next();

  const secret = process.env.AUTH_SECRET;
  const session = secret ? await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  if (session) return NextResponse.next();

  const login = new URL("/admin/login", request.url);
  if (pathname !== "/admin") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
