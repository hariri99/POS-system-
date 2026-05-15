import { InventoryControl } from "@/components/inventory/inventory-control";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/platform";

export default async function AdminInventoryPage() {
  const session = await requireRole("admin");
  const snapshot = await getDashboardSnapshot(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Stock operations"
        description="Record replenishment, audit adjustments, and movement history while keeping quantities synchronized with live sales."
        badge={`${snapshot.summary.lowStockCount} low stock`}
      />
      <InventoryControl
        products={snapshot.products}
        suppliers={snapshot.suppliers}
        movements={snapshot.stockMovements}
      />
    </div>
  );
}
