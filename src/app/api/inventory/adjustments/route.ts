import { adjustInventory } from "@/lib/platform";
import { apiError, apiSuccess, requireApiRole } from "@/lib/api";
import { inventoryAdjustmentSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const session = await requireApiRole("admin");
    const payload = inventoryAdjustmentSchema.parse(await request.json());
    const movement = await adjustInventory(
      {
        ...payload,
        supplierId: payload.supplierId ?? null,
      },
      session,
    );
    return apiSuccess(movement, "Inventory updated.");
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

    return apiError("Unexpected error while updating inventory.", 500);
  }
}

