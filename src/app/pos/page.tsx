import { PosTerminal } from "@/components/pos/pos-terminal";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { PageHeader } from "@/components/ui/page-header";
import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth";
import { getPosPageData } from "@/lib/platform";

export default async function PosPage() {
  const session = await requireRole(["admin", "employee"]);
  const data = await getPosPageData(session);

  return (
    <AppShell session={session}>
      <div className="space-y-6">
        <RealtimeRefresh
          channelName="pos-sync"
          tables={["sales", "inventory"]}
          refreshDebounceMs={1500}
        />
        <PageHeader
          eyebrow="POS"
          title="Cashier terminal"
          description="Search products fast, update quantities instantly, and complete inventory-aware sales with minimal clicks."
          badge={`${data.products.length} sellable products`}
        />
        <PosTerminal
          products={data.products}
          recentSales={data.recentSales}
          canViewAdvancedPricing={session.role === "admin"}
        />
      </div>
    </AppShell>
  );
}
