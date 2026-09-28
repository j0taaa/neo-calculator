import { serviceBundles } from "@/config/services/bundles";
import { createCatalogRoute } from "@/lib/create-catalog-route";
import { getCatalogFetchFn } from "@/lib/catalog-fetch-registry";

type CatalogRouteConfig = {
  serviceCode: string;
  serviceName: string;
  responseKey?: string;
  wrapWithErrorHandler?: boolean;
};

const routeConfigMap = new Map<string, CatalogRouteConfig>(serviceBundles.flatMap(({ service, runtime }) => {
  if (!runtime?.catalog) return [];
  return [[runtime.catalog.route, {
    serviceCode: service.serviceCode,
    serviceName: service.serviceName,
    responseKey: runtime.catalog.catalogPath ?? "catalog",
    wrapWithErrorHandler: true,
  }]];
}));

export function generateCatalogRoute(dirName: string) {
  const config = routeConfigMap.get(dirName);
  if (!config) throw new Error(`Unknown catalog route: ${dirName}`);

  const fetchFn = getCatalogFetchFn(config.serviceCode);
  if (!fetchFn) throw new Error(`No fetch function for service code: ${config.serviceCode}`);

  return createCatalogRoute(fetchFn, {
    serviceName: config.serviceName,
    responseKey: config.responseKey,
    wrapWithErrorHandler: config.wrapWithErrorHandler,
  });
}
