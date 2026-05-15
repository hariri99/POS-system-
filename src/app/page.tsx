import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Boxes, ReceiptText, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAppSession } from "@/lib/auth";

const highlights = [
  {
    title: "Cashier-fast POS",
    description: "Search products instantly, confirm totals quickly, and keep the checkout flow clean during peak store traffic.",
    icon: ReceiptText,
  },
  {
    title: "Inventory discipline",
    description: "Track stock movements, expiry pressure, and replenishment activity without spreadsheet-heavy workflows.",
    icon: Boxes,
  },
  {
    title: "Role-aware security",
    description: "Use Supabase Auth, protected routes, and operational permissions built for owners and employees.",
    icon: ShieldCheck,
  },
  {
    title: "Remote store visibility",
    description: "Monitor revenue, alerts, and staff performance from desktop, tablet, or phone.",
    icon: BarChart3,
  },
];

export default async function HomePage() {
  const session = await getAppSession();

  if (session) {
    redirect(session.role === "admin" ? "/admin" : "/pos");
  }

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] flex-col">
        <header className="surface-card flex items-center justify-between rounded-[24px] px-5 py-4">
          <div className="flex items-center gap-3">
            <Badge className="border-[var(--border-accent)] bg-[var(--brand-surface)] text-[var(--brand)]">
              ProteinOS
            </Badge>
            <p className="hidden text-sm text-[var(--muted-foreground)] md:block">
              Premium POS and inventory operations for supplement retail
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle compact />
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-sm font-semibold text-[var(--heading)] transition-colors hover:bg-[var(--surface-soft)]"
            >
              Open platform
            </Link>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.16fr_0.84fr] lg:py-20">
          <div className="space-y-8">
            <Badge className="border-[var(--border-accent)] bg-[var(--brand-surface)] text-[var(--brand)]">
              Next.js and Supabase architecture
            </Badge>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-[var(--heading)] md:text-7xl">
                Premium retail control for protein and supplement stores.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
                ProteinOS replaces spreadsheet-heavy stock routines and fragmented checkout tools
                with one responsive platform for selling, inventory, staff, suppliers, and
                reporting.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-[var(--brand-strong)]"
              >
                Launch dashboard
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#capabilities"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-5 text-sm font-semibold text-[var(--heading)] transition-colors hover:bg-[var(--surface-soft)]"
              >
                Explore capabilities
              </a>
            </div>
          </div>

          <Card className="data-grid relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[var(--brand-surface)] to-transparent" />
            <div className="relative space-y-5">
              <div>
                <p className="section-kicker">Built for</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[var(--heading)]">
                  Hybrid POS and management operations
                </h2>
              </div>
              <div className="grid gap-3">
                {[
                  "Supabase Auth with admin and employee roles",
                  "Realtime stock-aware POS workflow",
                  "Product and expiry management for supplements",
                  "Sales analytics designed for mobile and desktop",
                ].map((item) => (
                  <div
                    key={item}
                    className="surface-card-strong rounded-[18px] px-4 py-3 text-sm text-[var(--muted-foreground)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section id="capabilities" className="grid gap-5 pb-8 md:grid-cols-2 xl:grid-cols-4">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="space-y-4">
                <div className="inline-flex rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-[var(--brand)]">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[var(--heading)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                    {item.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}
