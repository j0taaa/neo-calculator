import { startEcsCatalogAutoRefresh } from "@/lib/ecs-flavor-catalog";

export const runtime = "nodejs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startEcsCatalogAutoRefresh();
  }
}
