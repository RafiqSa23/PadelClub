import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Guard antarmuka: cookie ada (token sesi real atau demo "1" masa transisi).
  // Otorisasi sesungguhnya ditegakkan di tiap API /api/admin/* via getCurrentAdmin().
  const hasSession = (request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? '').length > 0;

  if (pathname === "/admin" && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin/") && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
