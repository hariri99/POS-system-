import { apiError, apiSuccess, requireApiRole } from "@/lib/api";
import { archiveProduct } from "@/lib/platform";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  try {
    await requireApiRole("admin");
    const { productId } = await context.params;
    const product = await archiveProduct(productId);
    return apiSuccess(product, "Product archived.");
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

    return apiError("Unexpected error while archiving product.", 500);
  }
}

