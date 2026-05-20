import { ExecutiveReportsDashboard } from "@/components/reports/executive-reports-dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getReportsSnapshot } from "@/lib/platform";
import { buildExecutiveReport } from "@/lib/reporting";

export default async function AdminReportsPage() {
  const session = await requireRole("admin");
  const snapshot = await getReportsSnapshot(session);
  const report = buildExecutiveReport(snapshot);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Revenue, profit, and retail performance"
        description="Separate revenue from real profit, compare retail and wholesale margins, and keep the owner focused on operational performance instead of vanity totals."
        badge={`${report.monthlyProfitTrend.length} monthly periods`}
      />
      <ExecutiveReportsDashboard report={report} recentSales={snapshot.sales} />
    </div>
  );
}
