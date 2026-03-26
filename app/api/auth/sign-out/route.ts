import { handleAuthRequest } from "@/lib/auth-route-handler";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleAuthRequest(auth.api.signOut, request);
}
