import { LoginPanel } from "@/components/auth/login-panel";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Card } from "@/components/ui/card";
import { hasSupabaseEnv } from "@/lib/env";

export default function LoginPage() {
  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-kicker">Access gateway</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
              Role-based staff authentication
            </h1>
          </div>
          <div className="flex items-start gap-4">
            <div className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
              One professional login screen for admins and employees. Each staff member signs in
              with a login name and password, then lands in the correct workspace automatically.
              Demo access is no longer available.
            </div>
            <ThemeToggle compact />
          </div>
        </Card>

        <LoginPanel isSupabaseEnabled={hasSupabaseEnv} />
      </div>
    </main>
  );
}
