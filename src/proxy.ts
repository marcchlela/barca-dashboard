import { NextResponse, type NextRequest } from "next/server";

/** Defense in depth only. Route handlers and pages enforce their own production boundary. */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  const path = request.nextUrl.pathname;
  const admin = path === "/admin" || path.startsWith("/admin/") || path === "/api/admin" || path.startsWith("/api/admin/");
  const personalMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()) &&
    (path.startsWith("/api/favourites/") || path.startsWith("/api/matches/") && path.endsWith("/diary") || path === "/api/media/saves");
  if ((admin || personalMutation) && !request.cookies.has("__Host-barca_session")) {
    return new NextResponse(null, { status: admin ? 404 : 401, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/favourites/:path*", "/api/matches/:path*", "/api/media/saves"],
};
