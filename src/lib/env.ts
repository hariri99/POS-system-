export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey:
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export const hasSupabaseEnv = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const hasSupabaseServiceRole = Boolean(
  env.supabaseUrl && env.supabaseServiceRoleKey,
);

export const DEMO_SESSION_COOKIE = "protein_demo_session";
