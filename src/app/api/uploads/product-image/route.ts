import { nanoid } from "nanoid";
import { apiError, apiSuccess, requireApiRole } from "@/lib/api";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    await requireApiRole("admin");
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("A file is required.");
    }

    if (!file.type.startsWith("image/")) {
      return apiError("Only image files are allowed.");
    }

    if (file.size > 5 * 1024 * 1024) {
      return apiError("Image must be 5MB or smaller.");
    }

    const admin = createAdminSupabaseClient();
    if (!admin) {
      return apiError(
        "Supabase Storage upload is available after service role credentials are configured.",
        501,
      );
    }

    const fileExt = file.name.split(".").pop() ?? "jpg";
    const path = `products/${nanoid(10)}.${fileExt}`;
    const { error } = await admin.storage.from("product-images").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      return apiError(error.message, 400);
    }

    const { data } = admin.storage.from("product-images").getPublicUrl(path);
    return apiSuccess({ url: data.publicUrl }, "Image uploaded.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return apiError("Please sign in.", 401);
      }

      if (error.message === "FORBIDDEN") {
        return apiError("Admin access is required.", 403);
      }
    }

    return apiError("Unexpected error while uploading image.", 500);
  }
}
