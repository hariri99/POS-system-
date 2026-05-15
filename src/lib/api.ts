import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth";
import { type ApiResponse, type UserRole } from "@/lib/types";

export function apiSuccess<T>(data: T, message?: string) {
  return NextResponse.json({
    success: true,
    message,
    data,
  } satisfies ApiResponse<T>);
}

export function apiError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    } satisfies ApiResponse<never>,
    { status },
  );
}

export async function requireApiRole(role: UserRole | UserRole[]) {
  const session = await getAppSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(session.role)) {
    throw new Error("FORBIDDEN");
  }

  return session;
}

