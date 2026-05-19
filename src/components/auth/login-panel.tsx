"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginPanel({ isSupabaseEnabled }: { isSupabaseEnabled: boolean }) {
  const router = useRouter();
  const [staffName, setStaffName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseEnabled) {
      setError(
        "Supabase is required before anyone can sign in. Demo mode has been removed, so connect the live project and create staff accounts first.",
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffName,
          password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
            data?: { redirectTo?: string };
          }
        | null;

      if (!response.ok || !payload?.success || !payload.data?.redirectTo) {
        setError(payload?.message ?? "Unable to sign in right now.");
        return;
      }

      router.push(payload.data.redirectTo);
      router.refresh();
    } catch {
      setError("Unexpected error while signing in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <Card className="space-y-6">
        <div className="space-y-3">
          <div className="inline-flex rounded-xl border border-[var(--border-accent)] bg-[var(--brand-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand)]">
            Secure access
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
              Staff sign in
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
              Use your assigned staff name and password. The system automatically routes admins to
              management and employees to the cashier terminal.
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleLogin}>
          <label className="block space-y-2">
            <span className="field-label">Staff name</span>
            <Input
              value={staffName}
              onChange={(event) => setStaffName(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block space-y-2">
            <span className="field-label">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <Button className="w-full" type="submit" disabled={isSubmitting || !isSupabaseEnabled}>
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Continue
          </Button>
        </form>

        {!isSupabaseEnabled ? (
          <div className="rounded-[18px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-[var(--heading)] dark:text-white">
            This app is now real-only. Configure the Supabase environment keys and create real
            staff accounts before using the platform.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[18px] border border-[var(--danger)]/18 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--heading)] dark:text-white">
            {error}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
