"use client";

import { InventoryRiskPanel } from "@/components/dashboard/inventory-risk-panel";
import { TransactionListPanel } from "@/components/sales/transaction-list-panel";
import { isRefundableStatus } from "@/lib/sale-math";
import { type ProductRecord, type SaleRecord } from "@/lib/types";

interface OperationsOverviewWidgetsProps {
  sales: SaleRecord[];
  products: ProductRecord[];
}

export function OperationsOverviewWidgets({
  sales,
  products,
}: OperationsOverviewWidgetsProps) {
  const completedSales = sales.filter((sale) => sale.status === "completed");
  const revenueActiveSales = completedSales.filter((sale) => isRefundableStatus(sale.paymentStatus));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <TransactionListPanel
        title="Unpaid invoices"
        description="Compact receivables list with aging visibility, internal scrolling, and quick drill-in."
        sales={completedSales}
        defaultStatus="pending"
        availableStatuses={["pending"]}
        badge={`${completedSales.filter((sale) => sale.paymentStatus === "pending").length} open`}
        actionHref="/admin/sales"
        pageSize={6}
        emptyMessage="No unpaid invoices are waiting for follow-up."
      />

      <TransactionListPanel
        title="Revenue-active transactions"
        description="Paid and partially refunded orders stay in a dense, review-friendly feed instead of an endless card stack."
        sales={revenueActiveSales}
        defaultStatus="all"
        availableStatuses={["all", "paid", "partially_refunded"]}
        badge={`${revenueActiveSales.length} active`}
        actionHref="/admin/sales"
        pageSize={6}
        emptyMessage="No revenue-active transactions have been recorded for the selected period."
      />

      <InventoryRiskPanel products={products} sales={completedSales} pageSize={6} />

      <TransactionListPanel
        title="Recent sales activity"
        description="Compact timeline rows grouped by day so managers can audit order flow without stretching the page."
        sales={completedSales}
        defaultStatus="all"
        availableStatuses={["all", "paid", "pending", "partially_refunded", "refunded"]}
        badge={`${completedSales.length} recent`}
        actionHref="/admin/sales"
        pageSize={8}
        groupByDay
        emptyMessage="Recent sales activity will appear here after the next completed order."
      />
    </div>
  );
}
