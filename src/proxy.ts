import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const publicRoutes = ["/", "/login"];

function readDemoRole(request: NextRequest) {
  const session = request.cookies.get("protein_demo_session")?.value;
  if (!session) {
    return null;
  }

  try {
    const parsed = JSON.parse(session) as { role?: string };
    return parsed.role ?? null;
  } catch {
    return null;
  }
}

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

  const demoRole = readDemoRole(request);

  if (pathname.startsWith("/admin") && demoRole === "employee") {
    return NextResponse.redirect(new URL("/pos", request.url));
  }

  if (pathname.startsWith("/admin") && !demoRole) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/pos") && !demoRole) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

