import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { hasSupabaseEnv } from "@/lib/env";
import { env } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type AppSession, type UserRole } from "@/lib/types";

const APP_SESSION_COOKIE_NAME = "proteinos-app-session";
const APP_SESSION_TTL_MS = 1000 * 60 * 60 * 8;

type AppSessionCookiePayload = AppSession & {
  exp: number;
};

function getAppSessionSecret() {
  return env.supabaseServiceRoleKey ?? env.supabaseAnonKey ?? null;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signAppSessionPayload(payload: string) {
  const secret = getAppSessionSecret();
  if (!secret) {
    return null;
  }

  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function parseSignedAppSessionCookie(value: string | undefined): AppSession | null {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signAppSessionPayload(encodedPayload);
  if (!expectedSignature) {
    return null;
  }

  const providedSignature = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    providedSignature.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignature, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<AppSessionCookiePayload>;
    if (
      typeof payload?.exp !== "number" ||
      payload.exp <= Date.now() ||
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.fullName !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.branchId !== "string" ||
      typeof payload.branchName !== "string" ||
      typeof payload.mode !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role as UserRole,
      branchId: payload.branchId,
      branchName: payload.branchName,
      mode: payload.mode as AppSession["mode"],
    };
  } catch {
    return null;
  }
}

async function readSignedAppSessionCookie() {
  const cookieStore = await cookies();
  return parseSignedAppSessionCookie(cookieStore.get(APP_SESSION_COOKIE_NAME)?.value);
}

export async function setAppSessionCookie(session: AppSession) {
  const secret = getAppSessionSecret();
  if (!secret) {
    return;
  }

  const payload: AppSessionCookiePayload = {
    ...session,
    exp: Date.now() + APP_SESSION_TTL_MS,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signAppSessionPayload(encodedPayload);
  if (!signature) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE_NAME, `${encodedPayload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    path: "/",
    expires: new Date(payload.exp),
  });
}

export async function clearAppSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    path: "/",
    maxAge: 0,
  });
}

export async function getAppSession() {
  if (!hasSupabaseEnv) {
    return null;
  }

  const signedCookieSession = await readSignedAppSessionCookie();
  if (signedCookieSession) {
    return signedCookieSession;
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

  const session = {
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

  try {
    await setAppSessionCookie(session);
  } catch {
    // Server components cannot always mutate cookies during render.
  }

  return session;
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
