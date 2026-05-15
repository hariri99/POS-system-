"use client";

import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient() {
  if (!hasSupabaseEnv) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(env.supabaseUrl!, env.supabaseAnonKey!);
  }

  return browserClient;
}

