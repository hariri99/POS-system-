import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "ok",
    mode: hasSupabaseEnv ? "supabase" : "demo",
    timestamp: new Date().toISOString(),
  });
}

