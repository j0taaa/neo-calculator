import { getApiKeyUser, jsonError, readJsonBody } from "@/lib/api-route";
import { fetchElbPricingCatalog } from "@/lib/elb-pricing";
import { getCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { fetchWafPricingCatalog } from "@/lib/waf-pricing";
import { estimateWafConfiguration } from "@/lib/waf-catalog";
import { listStoredEcsFlavors, type BillingMode } from "@/lib/ecs-flavor-catalog";

export const runtime = "nodejs";

type PricingInputProduct = {
  serviceCode: string;
  productType: string;
  quantity?: number;
  config: Record<string, unknown>;
};

type CalculatePricingRequest = {
  region?: string;
  products: PricingInputProduct[];
};

type PricingResult = {
  serviceCode: string;
  productType: string;
  quantity: number;
  config: Record<string, unknown>;
  pricing: {
    total: string;
    breakdown: Record<string, string>;
    currency: string;
  } | null;
  error?: string;
};

async function calculateEcsPricing(config: Record<string, unknown>, regionId: string, billingMode: string): Promise<{ amount: number; currency: string } | null> {
  const flavor = config.flavor as string;
  if (!flavor) return null;

  await import("@/lib/ecs-flavor-catalog").then(async ({ ensureRegionCatalogAvailable }) => {
    await ensureRegionCatalogAvailable(regionId);
  });

  const flavors = listStoredEcsFlavors(regionId);
  const storedFlavor = flavors.find((f) => f.resourceSpecCode === flavor);
  if (!storedFlavor) return null;

  const mode: BillingMode = billingMode === "Pay-per-use" ? "ONDEMAND" : billingMode === "Yearly/Monthly" ? "YEARLY" : billingMode === "RI" ? "RI" : "ONDEMAND";
  const amount = storedFlavor.prices[mode] ?? storedFlavor.prices.ONDEMAND;
  if (typeof amount !== "number") return null;

  return { amount, currency: storedFlavor.currency };
}

async function calculateElbPricing(config: Record<string, unknown>, regionId: string, billingMode: string): Promise<{ amount: number; currency: string } | null> {
  try {
    const catalog = await fetchElbPricingCatalog(regionId);
    const type = config.type as string;
    const isDedicated = type === "Dedicated load balancer";
    const mode = billingMode === "Pay-per-use" ? "ONDEMAND" : billingMode === "Yearly/Monthly" ? "MONTHLY" : "ONDEMAND";

    if (!isDedicated) {
      const sharedRate = catalog.sharedRates?.[mode];
      if (typeof sharedRate === "number") {
        return { amount: sharedRate, currency: catalog.currency || "USD" };
      }
      if (typeof catalog.sharedRates?.ONDEMAND === "number") {
        return { amount: catalog.sharedRates.ONDEMAND, currency: catalog.currency || "USD" };
      }
    } else {
      const elasticRates = catalog.dedicatedRates?.elastic;
      if (elasticRates) {
        for (const subAz of Object.keys(elasticRates)) {
          const azData = elasticRates[subAz as keyof typeof elasticRates];
          if (azData?.basePerHour && typeof azData.basePerHour === "number") {
            return { amount: azData.basePerHour, currency: catalog.currency || "USD" };
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function calculateWafPricing(config: Record<string, unknown>, regionId: string): Promise<{ amount: number; currency: string; suffix?: string } | null> {
  try {
    const catalog = await fetchWafPricingCatalog(regionId);
    const edition = config.edition as string;
    const quantity = (config.quantity as number) || 1;

    const estimate = estimateWafConfiguration(catalog, { edition, quantity });
    if (estimate) {
      return { amount: estimate.amount, currency: estimate.currency, suffix: estimate.suffix };
    }
    return null;
  } catch {
    return null;
  }
}

function formatPrice(amount: number, currency: string, suffix?: string): string {
  const formattedSuffix = suffix ? (suffix.startsWith("/") ? suffix : `/${suffix}`) : "";
  return `USD ${amount.toFixed(2)}${formattedSuffix}`;
}

export async function POST(request: Request) {
  const apiKeyUser = await getApiKeyUser(request.headers);
  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const body = await readJsonBody<CalculatePricingRequest>(request);
  if (!body) {
    return jsonError("Invalid request body");
  }

  const products = body.products;
  if (!Array.isArray(products) || products.length === 0) {
    return jsonError("products array is required");
  }

  const regionKey = (body.region && body.region in huaweiRegions ? body.region : "la-sao-paulo1") as HuaweiRegionKey;
  const regionId = getCatalogRegionId(regionKey) || "la-south-1";

  const results: PricingResult[] = await Promise.all(
    products.map(async (product) => {
      const { serviceCode, productType, quantity = 1, config } = product;
      const billingMode = (config.billingMode as string) || "Pay-per-use";

      try {
        let priceResult: { amount: number; currency: string; suffix?: string } | null = null;

        switch (serviceCode) {
          case "ECS":
            priceResult = await calculateEcsPricing(config, regionId, billingMode);
            break;
          case "ELB":
            priceResult = await calculateElbPricing(config, regionId, billingMode);
            break;
          case "WAF":
            priceResult = await calculateWafPricing(config, regionId);
            break;
          default: {
            return {
              serviceCode,
              productType,
              quantity,
              config,
              pricing: null,
              error: `Pricing calculation not yet implemented for ${serviceCode}`,
            };
          }
        }

        if (priceResult) {
          const total = priceResult.amount * quantity;
          return {
            serviceCode,
            productType,
            quantity,
            config,
            pricing: {
              total: formatPrice(total, priceResult.currency, priceResult.suffix),
              breakdown: {
                unit: formatPrice(priceResult.amount, priceResult.currency, priceResult.suffix),
                quantity: String(quantity),
              },
              currency: priceResult.currency,
            },
          };
        }

        return {
          serviceCode,
          productType,
          quantity,
          config,
          pricing: null,
          error: `Unable to calculate pricing for ${serviceCode} with current configuration`,
        };
      } catch (error) {
        return {
          serviceCode,
          productType,
          quantity,
          config,
          pricing: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
  );

  return Response.json({
    region: regionKey,
    calculatedAt: new Date().toISOString(),
    results,
  });
}