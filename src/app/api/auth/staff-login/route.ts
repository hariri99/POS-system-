import { apiError, apiSuccess } from "@/lib/api";
import { hasSupabaseEnv } from "@/lib/env";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

function normalizeStaffName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[._-]+/g, " ");
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv) {
    return apiError(
      "Live authentication is not configured. Connect Supabase before signing in.",
      503,
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { staffName?: string; loginName?: string; password?: string }
    | null;
  const staffName = normalizeStaffName(body?.staffName ?? body?.loginName ?? "");
  const password = body?.password?.trim() ?? "";

  if (staffName.length < 3 || password.length < 3) {
    return apiError("Enter a valid staff name and password.", 400);
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return apiError("The server is missing the Supabase service role key.", 503);
  }

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("email, role, status, full_name");

  if (profileError) {
    return apiError("Unable to validate this staff account right now.", 500);
  }

  const profile = (profiles ?? []).find(
    (candidate) => normalizeStaffName(String(candidate.full_name ?? "")) === staffName,
  );

  if (!profile?.email) {
    return apiError("Invalid staff name or password.", 401);
  }

  if (profile.status !== "active") {
    return apiError("This staff account is inactive. Contact the administrator.", 403);
  }

  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase!.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (signInError) {
    return apiError("Invalid staff name or password.", 401);
  }

  return apiSuccess(
    {
      role: profile.role,
      redirectTo: profile.role === "admin" ? "/admin" : "/pos",
    },
    "Signed in successfully.",
  );
}
