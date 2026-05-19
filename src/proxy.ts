import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const publicRoutes = ["/", "/login"];

export async function proxy(request: NextRequest) {
  const response = await updateSupabaseSession(request);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return response;
  }

  if (publicRoutes.includes(pathname)) {
    return response;
  }

  if (hasSupabaseEnv) {
    return response;
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
