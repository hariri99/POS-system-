"use client";

import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SaleProductsPreview } from "@/components/sales/sale-products-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPaymentMethod,
  formatPercent,
} from "@/lib/utils";
import type { ExecutiveReport } from "@/lib/reporting";
import type { SaleRecord } from "@/lib/types";

const RECENT_ACTIVITY_PREVIEW_COUNT = 3;

function KpiCard({
  label,
  value,
  helper,
  emphasis = "default",
}: {
  label: string;
  value: string;
  helper: string;
  emphasis?: "default" | "positive" | "warning";
}) {
  return (
    <Card className="space-y-3 rounded-[22px] p-4 lg:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className={cn(
          "text-2xl font-semibold tracking-[-0.04em]",
          emphasis === "positive"
            ? "text-emerald-600 dark:text-emerald-300"
            : emphasis === "warning"
              ? "text-amber-600 dark:text-amber-300"
              : "text-[var(--heading)]",
        )}
      >
        {value}
      </p>
      <p className="text-sm leading-6 text-[var(--muted-foreground)]">{helper}</p>
    </Card>
  );
}

function SectionCard({
  title,
  description,
  aside,
  children,
  className,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--heading)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-5 text-sm text-[var(--muted-foreground)]">
      {label}
    </div>
  );
}

export function ExecutiveReportsDashboard({
  report,
  recentSales,
}: {
  report: ExecutiveReport;
  recentSales: SaleRecord[];
}) {
  const [showAllRecentActivity, setShowAllRecentActivity] = useState(false);
  const hasMoreRecentActivity = recentSales.length > RECENT_ACTIVITY_PREVIEW_COUNT;
  const visibleRecentSales = showAllRecentActivity
    ? recentSales
    : recentSales.slice(0, RECENT_ACTIVITY_PREVIEW_COUNT);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <KpiCard
          label="Today Revenue"
          value={formatCurrency(report.kpis.todayRevenue)}
          helper="Gross money received today before cost and operating deductions."
        />
        <KpiCard
          label="Today Net Profit"
          value={formatCurrency(report.kpis.todayNetProfit)}
          helper="Real earnings after product cost and today's operating expenses."
          emphasis="positive"
        />
        <KpiCard
          label="Weekly Profit"
          value={formatCurrency(report.kpis.weeklyNetProfit)}
          helper={`Week-over-week ${formatPercent(report.kpis.comparisonToPreviousWeek)}.`}
          emphasis={report.kpis.comparisonToPreviousWeek >= 0 ? "positive" : "warning"}
        />
        <KpiCard
          label="Monthly Profit"
          value={formatCurrency(report.kpis.monthlyNetProfit)}
          helper="Current-month net result after COGS and tracked expenses."
          emphasis="positive"
        />
        <KpiCard
          label="Inventory Value"
          value={formatCurrency(report.kpis.inventoryValue)}
          helper="Current stock investment based on cost price."
        />
        <KpiCard
          label="Total Expenses"
          value={formatCurrency(report.kpis.totalExpenses)}
          helper="Tracked operating expenses across the reporting dataset."
          emphasis="warning"
        />
        <KpiCard
          label="Low Stock"
          value={String(report.kpis.lowStockProducts)}
          helper="Products currently at or below reorder threshold."
          emphasis="warning"
        />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Monthly Revenue vs Net Profit"
          description="Revenue stays separate from actual earnings so the owner can see whether growth is truly profitable."
          aside={<Badge>Jan to Dec</Badge>}
        >
          <div className="h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.monthlyProfitTrend} barCategoryGap="20%" barGap={8}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--muted-foreground)"
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-strong)",
                    borderRadius: "16px",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullLabel ?? "Month"
                  }
                  formatter={(value, name) => [
                    formatCurrency(typeof value === "number" ? value : Number(value ?? 0)),
                    name === "netProfit" ? "Net profit" : "Revenue",
                  ]}
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="var(--brand-surface-strong)"
                  radius={[10, 10, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="netProfit"
                  name="Net profit"
                  fill="var(--brand)"
                  radius={[10, 10, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Sales Trend"
          description="Daily revenue and profit bars for the current month so each day is easier to compare operationally."
          aside={<Badge>{report.salesTrend.length} days</Badge>}
        >
          <div className="h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.salesTrend} barCategoryGap="32%" barGap={4}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--muted-foreground)"
                  minTickGap={10}
                  tickFormatter={(value, index) => (index % 2 === 0 ? String(value) : "")}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-strong)",
                    borderRadius: "16px",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullLabel ?? "Day"
                  }
                  formatter={(value, name) => {
                    const numericValue =
                      typeof value === "number" ? value : Number(value ?? 0);
                    if (name === "transactions") {
                      return `${numericValue} orders`;
                    }

                    return [
                      formatCurrency(numericValue),
                      name === "netProfit" ? "Net profit" : "Revenue",
                    ];
                  }}
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="var(--brand-surface-strong)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={18}
                />
                <Bar
                  dataKey="netProfit"
                  name="Net profit"
                  fill="var(--brand)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Category Performance"
        description="Category-level revenue, net profit, margin strength, and inventory exposure in one operational view."
        aside={<Badge>{report.categoryPerformance.length} categories</Badge>}
      >
        {report.categoryPerformance.length === 0 ? (
          <EmptyState label="Category analytics will appear once completed sales are recorded." />
        ) : (
          <div className="subtle-scroll overflow-x-auto">
            <table className="data-table min-w-[860px] text-left text-sm">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Units</th>
                  <th>Revenue</th>
                  <th>Net profit</th>
                  <th>Margin</th>
                  <th>Inventory value</th>
                  <th>Profit share</th>
                </tr>
              </thead>
              <tbody>
                {report.categoryPerformance.map((category) => (
                  <tr key={category.categoryName}>
                    <td>
                      <div className="space-y-2">
                        <p className="font-medium text-[var(--heading)]">{category.categoryName}</p>
                        <div className="h-2.5 w-32 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                          <div
                            className="h-full rounded-full bg-[var(--brand)]"
                            style={{
                              width: `${Math.max(8, Math.min(100, category.profitShare * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>{category.unitsSold}</td>
                    <td className="font-medium text-[var(--heading)]">
                      {formatCurrency(category.revenue)}
                    </td>
                    <td className="font-medium text-[var(--heading)]">
                      {formatCurrency(category.netProfit)}
                    </td>
                    <td>{formatPercent(category.marginRate)}</td>
                    <td>{formatCurrency(category.inventoryValue)}</td>
                    <td>{formatPercent(category.profitShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Top Profit Products"
          description="Products generating the strongest blend of units, revenue, and true net contribution."
        >
          <div className="subtle-scroll overflow-x-auto">
            <table className="data-table text-left text-sm">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Units</th>
                  <th>Revenue</th>
                  <th>Net profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {report.topProducts.map((product) => (
                  <tr key={product.productId}>
                    <td>
                      <div className="space-y-1">
                        <p className="font-medium text-[var(--heading)]">{product.productName}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{product.categoryName}</p>
                      </div>
                    </td>
                    <td>{product.unitsSold}</td>
                    <td className="font-medium text-[var(--heading)]">
                      {formatCurrency(product.revenue)}
                    </td>
                    <td className="font-medium text-[var(--heading)]">
                      {formatCurrency(product.netProfit)}
                    </td>
                    <td>{formatPercent(product.marginRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Lowest Margin Products"
          description="Products moving volume but leaving less room after cost. Useful for repricing and wholesale control."
        >
          <div className="subtle-scroll overflow-x-auto">
            <table className="data-table text-left text-sm">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Units</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {report.lowestMarginProducts.map((product) => (
                  <tr key={product.productId}>
                    <td>
                      <div className="space-y-1">
                        <p className="font-medium text-[var(--heading)]">{product.productName}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{product.categoryName}</p>
                      </div>
                    </td>
                    <td>{product.unitsSold}</td>
                    <td>{formatCurrency(product.revenue)}</td>
                    <td>{formatCurrency(product.netProfit)}</td>
                    <td className="text-amber-700 dark:text-amber-300">
                      {formatPercent(product.marginRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Low Stock Intelligence"
          description="Restock signals with estimated runway based on the last 30 days of movement."
        >
          {report.lowStockIntelligence.length === 0 ? (
            <EmptyState label="No urgent low-stock products right now." />
          ) : (
            <div className="subtle-scroll overflow-x-auto">
              <table className="data-table text-left text-sm">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>On hand</th>
                    <th>Min</th>
                    <th>Sold 30d</th>
                    <th>Runway</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lowStockIntelligence.map((product) => (
                    <tr key={product.productId}>
                      <td className="font-medium text-[var(--heading)]">{product.productName}</td>
                      <td>{product.stockQuantity}</td>
                      <td>{product.reorderPoint}</td>
                      <td>{product.soldLast30Days}</td>
                      <td>
                        {product.estimatedDaysToStockout == null
                          ? "No movement"
                          : `${product.estimatedDaysToStockout} days`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Expiry Watch"
          description="Supplement lines that may soon turn into dead stock if not promoted or rotated."
        >
          {report.expiryAlerts.length === 0 ? (
            <EmptyState label="No near-expiry products are currently flagged." />
          ) : (
            <div className="subtle-scroll overflow-x-auto">
              <table className="data-table text-left text-sm">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Expiry</th>
                    <th>Days left</th>
                    <th>Stock</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {report.expiryAlerts.map((product) => (
                    <tr key={product.productId}>
                      <td>
                        <div className="space-y-1">
                          <p className="font-medium text-[var(--heading)]">{product.productName}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">{product.categoryName}</p>
                        </div>
                      </td>
                      <td>{formatDate(product.expiryDate)}</td>
                      <td
                        className={cn(
                          product.daysRemaining <= 30
                            ? "text-red-600 dark:text-red-300"
                            : "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {product.daysRemaining} days
                      </td>
                      <td>{product.stockQuantity}</td>
                      <td>{formatCurrency(product.inventoryValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Employee Performance"
          description="Orders handled, revenue produced, and profit contribution by staff."
        >
          {report.employeePerformance.length === 0 ? (
            <EmptyState label="Employee analytics will appear once sales are recorded." />
          ) : (
            <div className="space-y-3">
              {report.employeePerformance.map((employee) => (
                <div
                  key={employee.employeeId}
                  className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[var(--heading)]">{employee.employeeName}</p>
                    <Badge>{employee.orders} orders</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-[var(--muted-foreground)]">
                    <div className="flex items-center justify-between">
                      <span>Revenue</span>
                      <span className="font-medium text-[var(--heading)]">
                        {formatCurrency(employee.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Net profit</span>
                      <span className="font-medium text-[var(--heading)]">
                        {formatCurrency(employee.netProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Activity"
          description="Latest completed orders for quick operational review."
          aside={
            recentSales.length > 0 ? <Badge>{recentSales.length} activities</Badge> : undefined
          }
        >
          {recentSales.length === 0 ? (
            <EmptyState label="Recent transactions will appear here once orders are completed." />
          ) : (
            <div className="space-y-3">
              {visibleRecentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--heading)]">{sale.invoiceNumber}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {sale.employeeName} / {formatPaymentMethod(sale.paymentMethod)}
                      </p>
                      <SaleProductsPreview
                        items={sale.items}
                        maxVisible={2}
                        compact
                        showSummary={false}
                        className="mt-3"
                      />
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-[var(--heading)]">
                        {formatCurrency(sale.totalAmount)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {formatDateTime(sale.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {hasMoreRecentActivity ? (
                <div className="flex flex-col gap-3 rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {showAllRecentActivity
                      ? `Showing all ${recentSales.length} recent activities.`
                      : `Showing ${visibleRecentSales.length} of ${recentSales.length} recent activities.`}
                  </p>
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => setShowAllRecentActivity((current) => !current)}
                  >
                    {showAllRecentActivity
                      ? "Show less"
                      : `View more (${recentSales.length - visibleRecentSales.length})`}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
