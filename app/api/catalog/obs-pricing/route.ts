import { generateCatalogRoute } from "@/lib/generate-catalog-route";

export const revalidate = 300;
export const runtime = "nodejs";

export const GET = generateCatalogRoute("obs-pricing");
