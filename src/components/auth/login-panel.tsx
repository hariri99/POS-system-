"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function LoginPanel({ isSupabaseEnabled }: { isSupabaseEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(isSupabaseEnabled ? "" : "admin@protein.local");
  const [password, setPassword] = useState(isSupabaseEnabled ? "" : "password123");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSupabaseLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return;
    }

    startTransition(async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/admin");
      router.refresh();
    });
  }

  async function handleDemoLogin(role: "admin" | "employee") {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.message ?? "Unable to start demo session.");
        return;
      }

      router.push(role === "admin" ? "/admin" : "/pos");
      router.refresh();
    });
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
              Sign into ProteinOS
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
              Admins unlock the full management layer. Employees go straight into the fast POS flow
              with controlled permissions and live stock visibility.
            </p>
          </div>
        </div>

        {isSupabaseEnabled ? (
          <form className="space-y-4" onSubmit={handleSupabaseLogin}>
            <label className="block space-y-2">
              <span className="field-label">Email</span>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className="field-label">Password</span>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <Button className="w-full" type="submit" disabled={isPending}>
              {isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Continue with Supabase Auth
            </Button>
          </form>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button className="w-full" onClick={() => handleDemoLogin("admin")} disabled={isPending}>
              Launch admin demo
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => handleDemoLogin("employee")}
              disabled={isPending}
            >
              Launch cashier demo
            </Button>
          </div>
        )}

        {error ? (
          <div className="rounded-[18px] border border-[var(--danger)]/18 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--heading)] dark:text-white">
            {error}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
