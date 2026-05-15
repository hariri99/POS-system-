import { apiError, apiSuccess, requireApiRole } from "@/lib/api";
import { createSale } from "@/lib/platform";
import { posSaleSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const session = await requireApiRole(["admin", "employee"]);
    const payload = posSaleSchema.parse(await request.json());
    const sale = await createSale(payload, session);
    return apiSuccess(sale, "Sale completed.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return apiError("Please sign in.", 401);
      }

      if (error.message === "FORBIDDEN") {
        return apiError("POS access is required.", 403);
      }

      return apiError(error.message, 400);
    }

    return apiError("Unexpected error while processing sale.", 500);
  }
}

