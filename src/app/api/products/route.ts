import { apiError, apiSuccess, requireApiRole } from "@/lib/api";
import { ensureProductBarcode, ensureProductSku } from "@/lib/product-codes";
import { mutateProduct } from "@/lib/platform";
import { productMutationSchema } from "@/lib/validators";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    const session = await requireApiRole("admin");
    const rawPayload = await request.json();
    const payload = productMutationSchema.parse({
      ...rawPayload,
      sku: ensureProductSku(rawPayload),
      barcode: ensureProductBarcode(rawPayload),
    });
    const product = await mutateProduct(
      {
        ...payload,
        imageUrl: payload.imageUrl || null,
        expiryDate: payload.expiryDate || null,
      },
      session,
    );

    return apiSuccess(product, "Product saved.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return apiError("Please sign in.", 401);
      }

      if (error.message === "FORBIDDEN") {
        return apiError("Admin access is required.", 403);
      }

      if (error instanceof ZodError) {
        const message = error.issues
          .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
          .join(" | ");
        return apiError(message, 400);
      }

      return apiError(error.message, 400);
    }

    return apiError("Unexpected error while saving product.", 500);
  }
}
