import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type AppSession, type UserRole } from "@/lib/types";

export async function getAppSession() {
  if (!hasSupabaseEnv) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase!.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase!
    .from("profiles")
    .select("id, email, full_name, role, branch_id, branches(name)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    branchId: profile.branch_id,
    branchName: Array.isArray(profile.branches)
      ? profile.branches[0]?.name ?? "Main Branch"
      : (profile.branches as { name?: string } | null)?.name ?? "Main Branch",
    mode: "supabase",
  } satisfies AppSession;
}

export async function requireAppSession() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(role: UserRole | UserRole[]) {
  const session = await requireAppSession();
  const roles = Array.isArray(role) ? role : [role];

  if (!roles.includes(session.role)) {
    redirect(session.role === "employee" ? "/pos" : "/admin");
  }

  return session;
}
