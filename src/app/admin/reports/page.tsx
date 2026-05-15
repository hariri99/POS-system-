import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/platform";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function AdminReportsPage() {
  const session = await requireRole("admin");
  const snapshot = await getDashboardSnapshot(session);

  const productPerformance = snapshot.products
    .map((product) => {
      const soldQuantity = snapshot.sales.reduce((sum, sale) => {
        return (
          sum +
          sale.items
            .filter((item) => item.productId === product.id)
            .reduce((lineSum, item) => lineSum + item.quantity, 0)
        );
      }, 0);

      return {
        product,
        soldQuantity,
        revenue: soldQuantity * product.salePrice,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Reporting and KPI review"
        description="Review inventory health, sales contribution, supplier exposure, and performance signals without changing the core architecture."
        badge={`${snapshot.salesTrend.length} trend points`}
      />
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Inventory health summary</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Snapshot of operational exposure across stock and expiry.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="metric-tile rounded-[20px] p-4">
              <p className="text-sm text-[var(--muted-foreground)]">Low stock</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">
                {snapshot.summary.lowStockCount}
              </p>
            </div>
            <div className="metric-tile rounded-[20px] p-4">
              <p className="text-sm text-[var(--muted-foreground)]">Expiring soon</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">
                {snapshot.summary.expiringSoonCount}
              </p>
            </div>
            <div className="metric-tile rounded-[20px] p-4">
              <p className="text-sm text-[var(--muted-foreground)]">Pending payments</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">
                {snapshot.summary.pendingPayments}
              </p>
            </div>
            <div className="metric-tile rounded-[20px] p-4">
              <p className="text-sm text-[var(--muted-foreground)]">Tracked suppliers</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">
                {snapshot.suppliers.length}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div>
            <h2 className="text-xl font-semibold text-white">Best-selling products</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Product performance ranked by estimated revenue contribution.
            </p>
          </div>
          <div className="subtle-scroll mt-4 overflow-x-auto">
            <table className="data-table text-left text-sm">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Sold qty</th>
                  <th>Revenue</th>
                  <th>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {productPerformance.slice(0, 10).map(({ product, soldQuantity, revenue }) => (
                  <tr key={product.id}>
                    <td>
                      <div className="space-y-1">
                        <p className="font-medium text-white">
                          {product.name}
                          {product.flavor ? ` / ${product.flavor}` : ""}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {product.categoryName} / {product.brandName}
                        </p>
                      </div>
                    </td>
                    <td>{soldQuantity}</td>
                    <td className="font-medium text-white">{formatCurrency(revenue)}</td>
                    <td className="text-[var(--muted-foreground)]">{formatDate(product.expiryDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
