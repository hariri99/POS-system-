export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey:
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function isValidHttpUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const hasSupabaseEnv = Boolean(isValidHttpUrl(env.supabaseUrl) && env.supabaseAnonKey);
export const hasSupabaseServiceRole = Boolean(
  isValidHttpUrl(env.supabaseUrl) && env.supabaseServiceRoleKey,
);

export function assertSupabaseConfigured() {
  if (!hasSupabaseEnv) {
    throw new Error(
      "Supabase is required for this app. Demo mode has been removed, so configure the live environment keys first.",
    );
  }
}
