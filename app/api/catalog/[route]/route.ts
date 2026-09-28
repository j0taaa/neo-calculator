import { serviceBundles } from "@/config/services/bundles";
import { generateCatalogRoute } from "@/lib/generate-catalog-route";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ route: string }> }) {
  const { route } = await context.params;
  if (!serviceBundles.some((bundle) => bundle.runtime?.catalog?.route === route)) {
    return Response.json({ error: `Unknown catalog route: ${route}` }, { status: 404 });
  }
  return generateCatalogRoute(route)(request);
}
