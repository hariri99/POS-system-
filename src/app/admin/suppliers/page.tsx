import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/platform";

export default async function AdminSuppliersPage() {
  const session = await requireRole("admin");
  const snapshot = await getDashboardSnapshot(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Suppliers"
        title="Supplier relationships"
        description="Track contact information, product ownership, and replenishment dependencies across the catalog in a cleaner vendor view."
        badge={`${snapshot.suppliers.length} suppliers`}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {snapshot.suppliers.map((supplier) => (
          <Card key={supplier.id} className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{supplier.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {supplier.contactName} / {supplier.phone}
                </p>
              </div>
              <span className="status-pill border-sky-500/20 bg-sky-500/12 text-sky-200">
                {supplier.activeProducts} active products
              </span>
            </div>
            <p className="text-sm leading-7 text-[var(--muted-foreground)]">{supplier.notes}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="metric-tile rounded-[18px] p-4">
                <p className="text-sm text-[var(--muted-foreground)]">Restock history count</p>
                <p className="mt-2 text-2xl font-semibold text-white">{supplier.restockCount}</p>
              </div>
              <div className="metric-tile rounded-[18px] p-4">
                <p className="text-sm text-[var(--muted-foreground)]">Email</p>
                <p className="mt-2 text-sm font-medium text-white">{supplier.email}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
