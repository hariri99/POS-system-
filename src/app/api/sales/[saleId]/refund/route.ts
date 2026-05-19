import { apiError, apiSuccess, requireApiRole } from "@/lib/api";
import { refundPaidSale } from "@/lib/platform";
import { saleRefundSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  context: { params: Promise<{ saleId: string }> },
) {
  try {
    const session = await requireApiRole("admin");
    const payload = saleRefundSchema.parse(await request.json().catch(() => ({})));
    const { saleId } = await context.params;
    const sale = await refundPaidSale(
      saleId,
      {
        scope: payload.scope,
        saleItemId: payload.saleItemId,
        quantity: payload.quantity,
        reason: payload.reason,
      },
      session,
    );
    return apiSuccess(sale, "Refund processed and inventory restored.");
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

    return apiError("Unexpected error while refunding the sale.", 500);
  }
}
