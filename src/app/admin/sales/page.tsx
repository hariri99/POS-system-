import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/platform";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function AdminSalesPage() {
  const session = await requireRole("admin");
  const snapshot = await getDashboardSnapshot(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales"
        title="Transactions and invoices"
        description="Review cashier performance, payment outcomes, invoice timing, and line-level activity in a cleaner operations table."
        badge={`${snapshot.sales.length} tracked sales`}
      />
      <Card>
        <div className="subtle-scroll overflow-x-auto">
          <table className="data-table text-left text-sm">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Cashier</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Items</th>
                <th>Total</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="font-medium text-white">{sale.invoiceNumber}</td>
                  <td>{sale.employeeName}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        sale.status === "completed"
                          ? "border-emerald-500/20 bg-emerald-500/12 text-emerald-200"
                          : "border-amber-500/20 bg-amber-500/12 text-amber-200"
                      }`}
                    >
                      {sale.status}
                    </span>
                  </td>
                  <td className="text-[var(--muted-foreground)]">
                    {sale.paymentMethod} / {sale.paymentStatus}
                  </td>
                  <td>{sale.items.length}</td>
                  <td className="font-medium text-white">{formatCurrency(sale.totalAmount)}</td>
                  <td className="text-[var(--muted-foreground)]">{formatDateTime(sale.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
