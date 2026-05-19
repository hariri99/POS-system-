import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";

export async function GET() {
  if (!hasSupabaseEnv) {
    return NextResponse.json(
      {
        success: false,
        status: "configuration_required",
        mode: "unconfigured",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    status: "ok",
    mode: "supabase",
    timestamp: new Date().toISOString(),
  });
}
