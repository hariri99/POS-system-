import { apiError, apiSuccess, requireApiRole } from "@/lib/api";
import { getDashboardSnapshot } from "@/lib/platform";

export async function GET() {
  try {
    const session = await requireApiRole("admin");
    const snapshot = await getDashboardSnapshot(session);
    return apiSuccess({
      summary: snapshot.summary,
      trend: snapshot.salesTrend,
      alerts: snapshot.alerts,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return apiError("Please sign in.", 401);
      }

      if (error.message === "FORBIDDEN") {
        return apiError("Admin access is required.", 403);
      }

      return apiError(error.message, 400);
    }

    return apiError("Unexpected error while loading reports.", 500);
  }
}

