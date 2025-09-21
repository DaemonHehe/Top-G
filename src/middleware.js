import { NextResponse } from "next/server";

const AUTH_PAGES = new Set(["/login", "/register"]);

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;
  const hasToken = Boolean(token);

  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isProtectedApi =
    pathname.startsWith("/api/tasks") ||
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/lifts");
  const isAuthPage = AUTH_PAGES.has(pathname);

  if ((isDashboardRoute || isProtectedApi) && !hasToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && hasToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
    "/api/tasks/:path*",
    "/api/users/:path*",
    "/api/lifts/:path*",
  ],
};

