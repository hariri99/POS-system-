import { NextResponse } from "next/server";
import { createDemoSession } from "@/lib/auth";
import { DEMO_SESSION_COOKIE, hasSupabaseEnv } from "@/lib/env";
import { apiError } from "@/lib/api";

export async function POST(request: Request) {
  if (hasSupabaseEnv) {
    return apiError("Demo login is disabled when Supabase is configured.", 403);
  }

  const body = (await request.json().catch(() => null)) as { role?: "admin" | "employee" } | null;
  const role = body?.role;

  if (!role) {
    return apiError("A demo role is required.");
  }

  const session = await createDemoSession(role);
  const response = NextResponse.json({ success: true, data: session });
  response.cookies.set(DEMO_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}

