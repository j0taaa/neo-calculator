import { handleAuthRequest } from "@/lib/auth-route-handler";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleAuthRequest(auth.api.getSession, request);
}

export async function POST(request: Request) {
  return handleAuthRequest(auth.api.getSession, request);
}
