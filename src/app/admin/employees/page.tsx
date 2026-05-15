import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/platform";
import { formatCurrency, relativeTime } from "@/lib/utils";

export default async function AdminEmployeesPage() {
  const session = await requireRole("admin");
  const snapshot = await getDashboardSnapshot(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Employees"
        title="Staff activity and performance"
        description="Review sales contribution, transaction volume, role assignment, and recent access patterns without the visual noise of a generic SaaS panel."
        badge={`${snapshot.employees.length} team members`}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {snapshot.employees.map((employee) => (
          <Card key={employee.id} className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{employee.fullName}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {employee.email} / {employee.role}
                </p>
              </div>
              <span
                className={`status-pill ${
                  employee.status === "active"
                    ? "border-emerald-500/20 bg-emerald-500/12 text-emerald-200"
                    : "border-white/10 bg-white/[0.05] text-[var(--muted-foreground)]"
                }`}
              >
                {employee.status}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="metric-tile rounded-[18px] p-4">
                <p className="text-sm text-[var(--muted-foreground)]">Transactions</p>
                <p className="mt-2 text-2xl font-semibold text-white">{employee.transactionCount}</p>
              </div>
              <div className="metric-tile rounded-[18px] p-4">
                <p className="text-sm text-[var(--muted-foreground)]">Units sold</p>
                <p className="mt-2 text-2xl font-semibold text-white">{employee.totalSales}</p>
              </div>
              <div className="metric-tile rounded-[18px] p-4">
                <p className="text-sm text-[var(--muted-foreground)]">Revenue</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {formatCurrency(employee.totalRevenue)}
                </p>
              </div>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Last login {relativeTime(employee.lastLoginAt)}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
