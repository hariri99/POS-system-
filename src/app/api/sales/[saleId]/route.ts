import { apiError, apiSuccess, requireApiRole } from "@/lib/api";
import { voidPendingSale } from "@/lib/platform";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ saleId: string }> },
) {
  try {
    const session = await requireApiRole("admin");
    const { saleId } = await context.params;
    const sale = await voidPendingSale(saleId, session);
    return apiSuccess(sale, "Pending order deleted.");
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

    return apiError("Unexpected error while deleting the unpaid order.", 500);
  }
}
