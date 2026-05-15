import { SalesOverviewChart } from "@/components/charts/sales-overview-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/platform";
import { buildExecutiveReport } from "@/lib/reporting";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export default async function AdminOverviewPage() {
  const session = await requireRole("admin");
  const snapshot = await getDashboardSnapshot(session);
  const report = buildExecutiveReport(snapshot);
  const riskProducts = snapshot.products
    .filter((product) => product.stockQuantity <= product.reorderPoint || product.expiryDate)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <RealtimeRefresh channelName="admin-overview" tables={["sales", "inventory", "alerts"]} />
      <PageHeader
        eyebrow="Overview"
        title="Store performance and risk overview"
        description="Track live sales, stock exposure, staff output, and operational exceptions in a cleaner retail dashboard built for daily decision-making."
        badge={`${snapshot.summary.activeSkus} active SKUs`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today revenue"
          value={formatCurrency(report.kpis.todayRevenue)}
          helper="Gross cash-in across completed sales today"
        />
        <StatCard
          label="Today net profit"
          value={formatCurrency(report.kpis.todayNetProfit)}
          helper="Actual earnings after COGS and today's expenses"
        />
        <StatCard
          label="Monthly profit"
          value={formatCurrency(report.kpis.monthlyNetProfit)}
          helper="Current-month net result, not just sales volume"
        />
        <StatCard
          label="Inventory value"
          value={formatCurrency(report.kpis.inventoryValue)}
          helper="Capital currently sitting in stock"
          trend="down"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <SalesOverviewChart data={report.salesTrend} />
        <Card className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Alerts and exceptions</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Low stock, expiry pressure, and operational anomalies that need action.
            </p>
          </div>
          <div className="space-y-3">
            {snapshot.alerts.map((alert) => (
              <div key={alert.id} className="surface-card-strong rounded-[18px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{alert.title}</p>
                  <span
                    className={`status-pill ${
                      alert.severity === "critical"
                        ? "border-red-500/20 bg-red-500/12 text-red-200"
                        : "border-amber-500/20 bg-amber-500/12 text-amber-200"
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  {alert.message}
                </p>
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                  {formatDateTime(alert.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <div>
            <h2 className="text-xl font-semibold text-white">At-risk inventory</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Products trending toward stockouts or close expiry.
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {riskProducts.map((product) => (
              <div key={product.id} className="surface-card-strong rounded-[18px] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <p className="font-medium text-white">
                      {product.name}
                      {product.flavor ? ` / ${product.flavor}` : ""}
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {product.categoryName} / {product.brandName}
                    </p>
                  </div>
                  <span
                    className={`status-pill ${
                      product.stockQuantity <= product.reorderPoint
                        ? "border-amber-500/20 bg-amber-500/12 text-amber-200"
                        : "border-sky-500/20 bg-sky-500/12 text-sky-200"
                    }`}
                  >
                    {product.stockQuantity <= product.reorderPoint ? "Low stock" : "Expiry watch"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[var(--muted-foreground)] md:grid-cols-3">
                  <div className="metric-tile rounded-2xl px-4 py-3">
                    <p>On hand</p>
                    <p className="mt-1 font-semibold text-white">{product.stockQuantity}</p>
                  </div>
                  <div className="metric-tile rounded-2xl px-4 py-3">
                    <p>Reorder point</p>
                    <p className="mt-1 font-semibold text-white">{product.reorderPoint}</p>
                  </div>
                  <div className="metric-tile rounded-2xl px-4 py-3">
                    <p>Expiry</p>
                    <p className="mt-1 font-semibold text-white">{formatDate(product.expiryDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div>
            <h2 className="text-xl font-semibold text-white">Recent sales activity</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Quick audit trail of invoices, payment method, and employee responsibility.
            </p>
          </div>
          <div className="subtle-scroll mt-4 overflow-x-auto">
            <table className="data-table text-left text-sm">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Employee</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.sales.slice(0, 8).map((sale) => (
                  <tr key={sale.id}>
                    <td className="font-medium text-white">{sale.invoiceNumber}</td>
                    <td>{sale.employeeName}</td>
                    <td className="capitalize text-[var(--muted-foreground)]">{sale.paymentMethod}</td>
                    <td className="font-medium text-white">{formatCurrency(sale.totalAmount)}</td>
                    <td className="text-[var(--muted-foreground)]">{formatDateTime(sale.createdAt)}</td>
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
