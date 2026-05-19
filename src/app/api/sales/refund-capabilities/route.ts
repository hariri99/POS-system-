import { apiError, apiSuccess, requireApiRole } from "@/lib/api";
import { getRefundCapabilities } from "@/lib/platform";

export async function GET() {
  try {
    await requireApiRole("admin");
    const capabilities = await getRefundCapabilities();
    return apiSuccess(capabilities);
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

    return apiError("Unexpected error while reading refund capabilities.", 500);
  }
}
