import { SalesOverviewChart } from "@/components/charts/sales-overview-chart";
import { OperationsOverviewWidgets } from "@/components/dashboard/operations-overview-widgets";
import { StatCard } from "@/components/dashboard/stat-card";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getAdminOverviewSnapshot } from "@/lib/platform";
import { buildExecutiveReport } from "@/lib/reporting";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function AdminOverviewPage() {
  const session = await requireRole("admin");
  const snapshot = await getAdminOverviewSnapshot(session);
  const report = buildExecutiveReport(snapshot);

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
        <Card className="flex h-[30rem] flex-col overflow-hidden p-0">
          <div>
            <div className="border-b border-[var(--border)] bg-[linear-gradient(180deg,var(--surface)_0%,var(--surface-soft)_100%)] px-5 py-5">
              <h2 className="text-xl font-semibold text-white">Alerts and exceptions</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Low stock, expiry pressure, and operational anomalies that need action.
              </p>
            </div>
          </div>
          <div className="subtle-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
          </div>
        </Card>
      </div>

      <OperationsOverviewWidgets sales={snapshot.sales} products={snapshot.products} />
    </div>
  );
}
