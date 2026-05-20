import { SalesManager } from "@/components/sales/sales-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getSalesPageData } from "@/lib/platform";

export default async function AdminSalesPage() {
  const session = await requireRole("admin");
  const data = await getSalesPageData(session);
  const pendingCount = data.sales.filter(
    (sale) => sale.status === "completed" && sale.paymentStatus === "pending",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales"
        title="Transactions, invoices, refunds, and unpaid orders"
        description="Review cashier activity, process full-order or single-product refunds from the admin transaction workspace, separate unpaid pay-later orders from settled revenue, and manage receivables from one place."
        badge={`${pendingCount} unpaid`}
      />
      <SalesManager initialSales={data.sales} />
    </div>
  );
}
