"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Boxes,
  PackageSearch,
  ReceiptText,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type AppSession } from "@/lib/types";

const adminLinks = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/products", label: "Products", icon: PackageSearch },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/sales", label: "Sales", icon: ReceiptText },
  { href: "/admin/suppliers", label: "Suppliers", icon: Truck },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: Activity },
];

const employeeLinks = [
  { href: "/pos", label: "POS Terminal", icon: ReceiptText },
];

export function AppShell({
  session,
  children,
}: {
  session: AppSession;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const links = session.role === "admin" ? adminLinks : employeeLinks;

  return (
    <div className="min-h-screen text-[var(--foreground)]">
      <div className="mx-auto grid max-w-[1680px] gap-6 px-4 py-4 lg:grid-cols-[268px_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="surface-card sticky top-4 self-start rounded-[24px] p-4 lg:h-[calc(100vh-3rem)] lg:p-5">
          <div className="flex h-full flex-col gap-6">
            <div className="space-y-4">
              <Badge className="border-[var(--brand)]/25 bg-[var(--brand)]/12 text-[var(--brand-soft)]">
                ProteinOS
              </Badge>
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-[var(--brand-soft)]">
                  <Store className="size-5" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">Retail operations</h2>
                  <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                    
                  </p>
                </div>
              </div>
            </div>

            <nav className="space-y-1">
              {links.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-[var(--brand)]/30 bg-[var(--brand)]/14 text-white"
                        : "border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <span
                      className={`inline-flex size-8 items-center justify-center rounded-lg ${
                        active ? "bg-[var(--brand)]/20 text-[var(--brand-soft)]" : "bg-white/[0.04]"
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="truncate">{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="surface-card-strong mt-auto rounded-[20px] p-4">
              <p className="text-sm font-semibold text-white">{session.fullName}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                {session.role} access
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--muted-foreground)]">Branch</span>
                  <span className="text-right text-white">{session.branchName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--muted-foreground)]">Session</span>
                  <span className={session.mode === "demo" ? "text-amber-300" : "text-sky-300"}>
                    {session.mode === "demo" ? "Demo" : "Live"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="surface-card sticky top-4 z-20 mb-6 flex flex-col gap-4 rounded-[22px] p-4 backdrop-blur-md md:flex-row md:items-center md:justify-between lg:px-5">
            <div>
              <p className="text-sm font-semibold text-white">
                {session.role === "admin" ? "Store command dashboard" : "Cashier workspace"}
              </p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {session.mode === "demo"
                  ? "Demo session is active while live credentials are still being finalized."
                  : "Connected to Supabase with live stock, sales, and role-aware access."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                className={
                  session.mode === "demo"
                    ? "border-amber-500/25 bg-amber-500/12 text-amber-200"
                    : "border-sky-500/25 bg-sky-500/12 text-sky-200"
                }
              >
                {session.mode === "demo" ? "Demo session" : "Live session"}
              </Badge>
              <form action="/api/auth/logout" method="post">
                <Button variant="secondary" type="submit">
                  Sign out
                </Button>
              </form>
            </div>
          </header>

          <main className="space-y-6 pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
