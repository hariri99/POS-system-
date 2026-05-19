import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  if (hasSupabaseEnv) {
    const supabase = await createServerSupabaseClient();
    await supabase?.auth.signOut();
  }

  const response = NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    { status: 303 },
  );

  return response;
}
