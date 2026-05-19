import { apiError } from "@/lib/api";

export async function POST(request: Request) {
  void request;
  return apiError(
    "Demo access has been removed. Use real staff accounts with login name and password.",
    410,
  );
}
