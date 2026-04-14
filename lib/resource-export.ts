import { huaweiRegions } from "@/lib/huawei-regions";

export type ExportProductLike = {
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
  createdAt?: string;
  updatedAt?: string;
};

export type ExportListLike = {
  name: string;
  products: ExportProductLike[];
};

export type ExportProjectLike = {
  id?: string;
  name: string;
  ownerUserId: string;
  accessLevel: string;
  canShare: boolean;
  description: string | null;
  lists: ExportListLike[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getConfigSpecsSummary(config: unknown) {
  if (!isRecord(config)) {
    return "";
  }

  const parts: string[] = [];
  const vcpu = typeof config.vcpu === "number" ? config.vcpu : Number(config.vcpu ?? 0);
  const ramGiB = typeof config.ramGiB === "number" ? config.ramGiB : Number(config.ramGiB ?? 0);
  if (Number.isFinite(vcpu) && vcpu > 0) {
    parts.push(`${vcpu} vCPUs`);
  }
  if (Number.isFinite(ramGiB) && ramGiB > 0) {
    parts.push(`${ramGiB} GiB RAM`);
  }

  const diskType = typeof config.diskType === "string" ? config.diskType : null;
  if (diskType) {
    parts.push(diskType);
  }

  const sizeGiB = typeof config.sizeGiB === "number"
    ? config.sizeGiB
    : typeof config.diskSizeGiB === "number"
      ? config.diskSizeGiB
      : Number(config.storageAmountGb ?? 0);
  if (Number.isFinite(sizeGiB) && sizeGiB > 0) {
    parts.push(`${sizeGiB} GiB`);
  }

  const storageClass = typeof config.storageClass === "string" ? config.storageClass : null;
  if (storageClass) {
    parts.push(storageClass);
  }

  const redundancy = typeof config.redundancy === "string" ? config.redundancy : null;
  if (redundancy) {
    parts.push(redundancy);
  }

  return parts.join(" | ");
}

export function getRegionFromConfig(config: unknown): string {
  if (!isRecord(config)) {
    return "";
  }
  const region = config.region;
  if (typeof region === "string") {
    // Use proper capitalization from huaweiRegions if available
    if (region in huaweiRegions) {
      return huaweiRegions[region as keyof typeof huaweiRegions].short;
    }
    // Fallback: format the region key properly
    return region
      .split("-")
      .map((part) => {
        if (part.length <= 2) {
          return part.toUpperCase();
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join("-");
  }
  return "";
}

export function getDescriptionFromConfig(config: unknown, fallback: string): string {
  if (!isRecord(config)) {
    return fallback;
  }
  const description = config.description;
  if (typeof description === "string" && description.trim()) {
    return description.trim();
  }
  return fallback;
}

function parsePricingValue(pricing: unknown): { amount: number; hours: number | null; period: "hourly" | "monthly" | "yearly" | "total" } | null {
  if (!isRecord(pricing)) {
    return null;
  }

  // Try to get amount directly
  let amount: number | null = null;
  let hours: number | null = null;
  let period: "hourly" | "monthly" | "yearly" | "total" = "total";

  if (typeof pricing.amount === "number" && Number.isFinite(pricing.amount)) {
    amount = pricing.amount;
    const suffix = typeof pricing.suffix === "string" ? pricing.suffix : "";
    if (suffix.includes("mo")) {
      period = "monthly";
    } else if (suffix.includes("yr")) {
      period = "yearly";
    } else if (suffix.includes("h")) {
      // Check if it's a specific hour count like "744h" or just "h" for hourly
      const hourMatch = suffix.match(/(\d+)h/);
      if (hourMatch) {
        hours = parseInt(hourMatch[1], 10);
        period = "total"; // Amount is for the specified hours, not hourly rate
      } else {
        period = "hourly"; // True hourly rate
      }
    }
  } else if (typeof pricing.total === "string") {
    // Parse from total string like "USD 19.00/mo" or "USD 3.33/744h"
    const match = pricing.total.match(/USD\s+([\d.]+)(?:\/(mo|yr|(\d+)h|h))?/);
    if (match) {
      amount = parseFloat(match[1]);
      const suffix = match[2] || "";
      if (suffix === "mo") {
        period = "monthly";
      } else if (suffix === "yr") {
        period = "yearly";
      } else if (suffix === "h") {
        period = "hourly";
      } else if (match[3]) {
        // Matched specific hour count like "744"
        hours = parseInt(match[3], 10);
        period = "total";
      }
    }
  }

  if (amount === null || !Number.isFinite(amount)) {
    return null;
  }

  return { amount, hours, period };
}

export function getMonthlyPrice(pricing: unknown): number | null {
  const parsed = parsePricingValue(pricing);
  if (!parsed) return null;

  switch (parsed.period) {
    case "monthly":
      return parsed.amount;
    case "yearly":
      return parsed.amount / 12;
    case "hourly":
      // Convert hourly rate to monthly (hourly * 744 hours)
      return parsed.amount * 744;
    case "total":
      // If we have specific hours, calculate monthly based on that
      if (parsed.hours && parsed.hours > 0) {
        // Scale to monthly (744 hours)
        return (parsed.amount / parsed.hours) * 744;
      }
      return parsed.amount;
    default:
      return parsed.amount;
  }
}

function sanitizeSheetName(name: string) {
  const sanitized = name.replace(/[\\/?*[\]:]/g, " ").trim().replace(/\s+/g, " ");
  return (sanitized || "Cart").slice(0, 31);
}

function getUniqueSheetName(name: string, usedNames: Set<string>) {
  const baseName = sanitizeSheetName(name) || "Cart";
  let candidate = baseName;
  let suffix = 2;

  while (usedNames.has(candidate)) {
    const suffixText = ` (${suffix})`;
    candidate = `${baseName.slice(0, Math.max(1, 31 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

export function downloadTextFile(filename: string, contents: string, mimeType: string) {
  if (typeof document === "undefined") {
    return false;
  }

  const blob = new Blob([contents], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
  return true;
}

export function downloadBlobFile(filename: string, blob: Blob) {
  if (typeof document === "undefined") {
    return false;
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
  return true;
}

export function slugifyExportName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "resource";
}

export function buildNamedExportFilename(kind: string, name: string, extension: string) {
  const timestamp = new Date().toISOString().replace(/[:]/g, "-");
  return `neocalculator-${kind}-${slugifyExportName(name)}-${timestamp}.${extension}`;
}

export function buildProjectExportPayload(project: ExportProjectLike) {
  const totalProducts = project.lists.reduce((count, list) => count + list.products.length, 0);
  const totalQuantity = project.lists.reduce(
    (count, list) => count + list.products.reduce((sum, product) => sum + product.quantity, 0),
    0,
  );

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    resourceType: "project",
    summary: {
      listCount: project.lists.length,
      productCount: totalProducts,
      totalQuantity,
    },
    project,
  };
}

export function buildListExportPayload(project: ExportProjectLike, list: ExportListLike) {
  const totalQuantity = list.products.reduce((count, product) => count + product.quantity, 0);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    resourceType: "cart",
    summary: {
      productCount: list.products.length,
      totalQuantity,
    },
    project: {
      id: project.id,
      name: project.name,
      ownerUserId: project.ownerUserId,
      accessLevel: project.accessLevel,
      canShare: project.canShare,
    },
    cart: list,
  };
}

export async function downloadProjectWorkbookFile(project: ExportProjectLike, shareUrl?: string) {
  const { buildProjectWorkbookBuffer: buildBuffer } = await import("@/lib/resource-export-excel");
  const buffer = await buildBuffer(project, shareUrl);
  const blob = new Blob(
    [buffer],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  );
  return downloadBlobFile(
    buildNamedExportFilename("project", project.name, "xlsx"),
    blob,
  );
}

export type { FullCatalogExportData };

// ==================== FULL CATALOG EXPORT ====================

type FullCatalogExportData = {
  regions: string[];
  catalogs: Record<string, Record<string, unknown>>;
  flexusLPlans?: Array<{
    id: string;
    title: string;
    vcpu: number;
    ramGiB: number;
    systemDiskGiB: number;
    peakBandwidthMbit: number;
    dataPackageTiB: number;
    monthlyPriceUsd: number;
  }>;
  generatedAt: string;
};

type PriceInfo = { ondemand?: number; monthly?: number; ri?: number };

// Extract label from a catalog item
function getItemLabel(item: unknown): string {
  if (!item || typeof item !== "object") return "Unknown";
  const obj = item as Record<string, unknown>;

  const parts: string[] = [];
  if (typeof obj.specification === "string") parts.push(obj.specification);
  if (typeof obj.mode === "string") parts.push(obj.mode);
  if (typeof obj.allocation === "string") parts.push(obj.allocation);
  if (typeof obj.storageClass === "string") parts.push(obj.storageClass);
  if (typeof obj.redundancy === "string") parts.push(obj.redundancy);
  if (typeof obj.productType === "string") parts.push(obj.productType);
  if (typeof obj.label === "string") parts.push(obj.label);
  if (typeof obj.name === "string") parts.push(obj.name);
  if (typeof obj.type === "string") parts.push(obj.type);
  if (typeof obj.size === "string") parts.push(obj.size);
  if (typeof obj.version === "string") parts.push(obj.version);
  if (typeof obj.instanceType === "string") parts.push(obj.instanceType);
  if (typeof obj.architecture === "string") parts.push(obj.architecture);
  if (typeof obj.vaultType === "string") parts.push(obj.vaultType);
  if (typeof obj.engineType === "string") parts.push(obj.engineType);
  if (typeof obj.storageSpaceGb === "number") parts.push(`${obj.storageSpaceGb >= 1024 ? `${obj.storageSpaceGb / 1024}TB` : `${obj.storageSpaceGb}GB`}`);
  if (typeof obj.capacityGb === "number") parts.push(`${obj.capacityGb}GB`);
  if (typeof obj.memoryGiB === "number") parts.push(`${obj.memoryGiB}GB`);

  if (parts.length === 0 && typeof obj.resourceSpecCode === "string") {
    return obj.resourceSpecCode;
  }
  return parts.join(" | ") || "Unknown";
}

function readRateSet(rateSet: unknown): PriceInfo {
  const prices: PriceInfo = {};
  if (!rateSet || typeof rateSet !== "object") return prices;
  const rs = rateSet as Record<string, unknown>;
  if (typeof rs.ONDEMAND === "number") prices.ondemand = rs.ONDEMAND;
  if (typeof rs.MONTHLY === "number" && rs.MONTHLY > 0) prices.monthly = rs.MONTHLY;
  if (typeof rs.YEARLY === "number") {
    if (prices.monthly === undefined) prices.monthly = rs.YEARLY / 12;
  }
  return prices;
}

// Extract prices from various catalog item formats
function extractPrices(item: unknown): PriceInfo {
  const prices: PriceInfo = {};
  if (!item || typeof item !== "object") return prices;

  const obj = item as Record<string, unknown>;

  // Handle prices: {ONDEMAND, MONTHLY, YEARLY} (PricingRateSet - used by NAT, DCS, etc.)
  if (obj.prices && typeof obj.prices === "object" && !Array.isArray(obj.prices)) {
    Object.assign(prices, readRateSet(obj.prices));
  }

  // Handle plans array (VPN, CBR, SFS packageTiers, etc.)
  if (Array.isArray(obj.plans)) {
    for (const plan of obj.plans) {
      if (!plan || typeof plan !== "object") continue;
      const planObj = plan as Record<string, unknown>;
      const billingMode = String(planObj.billingMode || "").toUpperCase();

      let amount: number | undefined;
      if (typeof planObj.amount === "number") {
        amount = planObj.amount;
      } else if (Array.isArray(planObj.tiers) && planObj.tiers.length > 0) {
        // VPN-style division tiers: pick the first tier (start=0) or the lowest
        const sortedTiers = [...planObj.tiers]
          .filter((t: unknown) => t && typeof t === "object")
          .map((t: unknown) => t as Record<string, unknown>)
          .sort((a, b) => (a.start as number) - (b.start as number));
        if (sortedTiers.length > 0) {
          const firstTier = sortedTiers[0];
          // If there's a single flat tier (end=null), use its amount
          // Otherwise note it as a division rate (use the first tier's amount)
          amount = firstTier.amount as number;
        }
      }

      if (amount === undefined || !Number.isFinite(amount)) continue;

      if (billingMode === "ONDEMAND" || billingMode === "PAY-PER-USE") {
        if (prices.ondemand === undefined) prices.ondemand = amount;
      } else if (billingMode === "MONTHLY") {
        if (prices.monthly === undefined) prices.monthly = amount;
      } else if (billingMode === "YEARLY") {
        if (prices.monthly === undefined) prices.monthly = amount / 12;
      }
    }
  }

  // Handle direct rate objects (EIP dedicated/shared, ELB sharedRates)
  if (obj.eipRates && typeof obj.eipRates === "object") {
    const rs = readRateSet(obj.eipRates);
    if (rs.ondemand !== undefined) prices.ondemand = rs.ondemand;
    if (rs.monthly !== undefined) prices.monthly = rs.monthly;
  }
  if (obj.bandwidthRates && typeof obj.bandwidthRates === "object") {
    const rs = readRateSet(obj.bandwidthRates);
    if (prices.ondemand === undefined && rs.ondemand !== undefined) prices.ondemand = rs.ondemand;
    if (prices.monthly === undefined && rs.monthly !== undefined) prices.monthly = rs.monthly;
  }

  // Handle sharedRates (ELB) - flat PricingRateSet
  if (obj.sharedRates && typeof obj.sharedRates === "object" && !Array.isArray(obj.sharedRates)) {
    const rs = readRateSet(obj.sharedRates);
    if (rs.ondemand !== undefined) prices.ondemand = rs.ondemand;
    if (rs.monthly !== undefined) prices.monthly = rs.monthly;
  }

  // Handle storageRate (OBS)
  if (obj.storageRate && typeof obj.storageRate === "object") {
    const rate = obj.storageRate as Record<string, unknown>;
    if (typeof rate.amount === "number") prices.ondemand = rate.amount;
  }

  // Handle ratePerGbHour (SFS paygTiers) and similar rate fields
  if (typeof obj.ratePerGbHour === "number" && prices.ondemand === undefined) {
    prices.ondemand = obj.ratePerGbHour;
  }

  // Handle direct amount/price properties
  if (typeof obj.amount === "number" && prices.ondemand === undefined) {
    prices.ondemand = obj.amount;
  }

  // Handle direct ONDEMAND/MONTHLY properties
  if (typeof obj.ONDEMAND === "number" && prices.ondemand === undefined) {
    prices.ondemand = obj.ONDEMAND;
  }
  if (typeof obj.MONTHLY === "number" && prices.monthly === undefined) {
    prices.monthly = obj.MONTHLY;
  }

  return prices;
}

// Find all pricing components in a catalog
function findCatalogComponents(catalog: unknown): Array<{ label: string; items: unknown[] }> {
  if (!catalog || typeof catalog !== "object") return [];

  const components: Array<{ label: string; items: unknown[] }> = [];
  const catalogObj = catalog as Record<string, unknown>;

  // Skip these keys - non-pricing metadata or auxiliary scalars
  const skipKeys = ["currency", "regionId", "diskPricing", "lastCompletedAt", "syncing", "edition", "bandwidthRatePerMbitHour", "productIds"];

  for (const [key, value] of Object.entries(catalogObj)) {
    if (skipKeys.includes(key)) continue;

    // Handle arrays of pricing items
    if (Array.isArray(value) && value.length > 0) {
      const firstItem = value[0];
      if (firstItem && typeof firstItem === "object") {
        // Check if it looks like a pricing item
        const itemObj = firstItem as Record<string, unknown>;
        if (
          itemObj.plans || itemObj.resourceSpecCode || itemObj.storageRate ||
          itemObj.prices || itemObj.ratePerGbHour || itemObj.amount !== undefined
        ) {
          components.push({
            label: formatComponentLabel(key),
            items: value,
          });
        }
      }
    }
    // Handle nested objects with rates (EIP dedicated/shared, ELB sharedRates, etc.)
    else if (value && typeof value === "object") {
      const nestedObj = value as Record<string, unknown>;
      if (
        nestedObj.eipRates || nestedObj.bandwidthRates || nestedObj.sharedRates ||
        nestedObj.ONDEMAND !== undefined || nestedObj.prices
      ) {
        components.push({
          label: formatComponentLabel(key),
          items: [value],
        });
      }
    }
  }

  return components;
}

function formatComponentLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/_/g, " ")
    .trim();
}

// Build Excel workbook for full catalog export
export async function buildFullCatalogWorkbookBuffer(
  exportData: FullCatalogExportData,
  serviceCodes: string[],
  serviceNames: Record<string, string>,
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();
  const regions = exportData.regions;

  const dataStyle = {
    font: { name: "Arial", size: 10 },
    border: {
      top: { style: "thin" as const, color: { argb: "000000" } },
      bottom: { style: "thin" as const, color: { argb: "000000" } },
      left: { style: "thin" as const, color: { argb: "000000" } },
      right: { style: "thin" as const, color: { argb: "000000" } },
    },
  };

  // Process each service
  for (const serviceCode of serviceCodes) {
    // Skip ECS - handled separately
    if (serviceCode === "ECS") continue;

    const catalogs = exportData.catalogs[serviceCode];
    if (!catalogs || typeof catalogs !== "object") continue;

    const catalogsByRegion = catalogs as Record<string, unknown>;
    if (Object.keys(catalogsByRegion).length === 0) continue;

    const serviceName = serviceNames[serviceCode] || serviceCode;
    const sheetName = getUniqueSheetName(serviceName, usedNames);
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.views = [{ showGridLines: false }];

    const maxCols = regions.length * 2 + 1;

    // Title row
    const titleRow = worksheet.addRow([serviceName]);
    titleRow.height = 30;
    titleRow.getCell(1).font = { name: "Arial", size: 16, bold: true };
    worksheet.mergeCells(`A1:${String.fromCharCode(65 + Math.min(maxCols - 1, 25))}1`);
    worksheet.addRow([]);

    // Get first catalog to determine structure
    const firstCatalog = Object.values(catalogsByRegion)[0];
    if (!firstCatalog) continue;

    const components = findCatalogComponents(firstCatalog);

    if (components.length === 0) {
      const noteRow = worksheet.addRow(["No pricing data available"]);
      noteRow.getCell(1).font = { name: "Arial", size: 10, italic: true, color: { argb: "666666" } };
      continue;
    }

    // Create table for each component
    for (const component of components) {
      // Component header
      const compHeaderRow = worksheet.addRow([component.label]);
      compHeaderRow.height = 25;
      compHeaderRow.getCell(1).font = { name: "Arial", size: 12, bold: true, color: { argb: "003366" } };
      worksheet.mergeCells(`A${compHeaderRow.number}:${String.fromCharCode(65 + Math.min(maxCols - 1, 25))}${compHeaderRow.number}`);

      // Headers: Specification | Region1 Pay-per-use | Region1 Monthly | ...
      const headers = ["Specification"];
      for (const region of regions) {
        const regionInfo = huaweiRegions[region as keyof typeof huaweiRegions];
        const regionName = regionInfo?.short || region;
        headers.push(`${regionName} - Pay-per-use`);
        headers.push(`${regionName} - Monthly`);
      }

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "003366" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };
      });

      // Collect all items across regions
      const allLabels = new Set<string>();
      const pricesByRegion = new Map<string, Map<string, PriceInfo>>();

      for (const region of regions) {
        const catalog = catalogsByRegion[region];
        if (!catalog) continue;

        const regionComponents = findCatalogComponents(catalog);
        const matchingComponent = regionComponents.find(c => c.label === component.label);
        if (!matchingComponent) continue;

        const regionPrices = new Map<string, PriceInfo>();
        pricesByRegion.set(region, regionPrices);

        for (const item of matchingComponent.items) {
          const label = getItemLabel(item);
          allLabels.add(label);
          regionPrices.set(label, extractPrices(item));
        }
      }

      // Add data rows
      for (const label of allLabels) {
        const rowData: (string | number)[] = [label];

        for (const region of regions) {
          const regionPrices = pricesByRegion.get(region);
          const prices = regionPrices?.get(label);
          if (prices) {
            rowData.push(prices.ondemand !== undefined ? prices.ondemand : "");
            rowData.push(prices.monthly !== undefined ? prices.monthly : "");
          } else {
            rowData.push("", "");
          }
        }

        const row = worksheet.addRow(rowData);
        row.height = 22;
        row.eachCell((cell, colNum) => {
          Object.assign(cell, dataStyle);
          cell.alignment = { horizontal: colNum === 1 ? "left" : "right", vertical: "middle" };
          if (colNum > 1) {
            cell.numFmt = '"$"* #,##0.0000';
          }
        });
      }

      if (allLabels.size === 0) {
        const noteRow = worksheet.addRow(["No pricing data available"]);
        noteRow.getCell(1).font = { name: "Arial", size: 10, italic: true, color: { argb: "666666" } };
      }

      worksheet.addRow([]);
    }

    // Set column widths
    worksheet.getColumn(1).width = 35;
    for (let i = 2; i <= maxCols; i++) {
      worksheet.getColumn(i).width = 20;
    }
  }

  // Add ECS Flavors sheet
  if (exportData.catalogs["ECS"]) {
    const sheetName = getUniqueSheetName("ECS Flavors", usedNames);
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.views = [{ showGridLines: false }];

    const titleRow = worksheet.addRow(["ECS Flavors"]);
    titleRow.height = 30;
    titleRow.getCell(1).font = { name: "Arial", size: 16, bold: true };
    worksheet.mergeCells(`A1:${String.fromCharCode(65 + regions.length * 3)}1`);
    worksheet.addRow([]);

    const headers = ["Flavor", "vCPUs", "RAM (GiB)", "Family"];
    for (const region of regions) {
      const regionInfo = huaweiRegions[region as keyof typeof huaweiRegions];
      headers.push(`${regionInfo?.short || region} - Pay-per-use`);
      headers.push(`${regionInfo?.short || region} - Monthly`);
      headers.push(`${regionInfo?.short || region} - RI`);
    }

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "003366" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };
    });

    // Collect all flavors
    const allFlavors = new Map<string, { cpu: number; ramGiB: number; family: string; prices: Record<string, PriceInfo> }>();

    for (const region of regions) {
      const catalog = exportData.catalogs["ECS"][region] as { flavors?: Array<{ resourceSpecCode: string; cpu: number; ramGiB: number; family: string; prices: { ONDEMAND?: number; MONTHLY?: number; RI?: number } }> };
      if (catalog?.flavors) {
        for (const flavor of catalog.flavors) {
          if (!allFlavors.has(flavor.resourceSpecCode)) {
            allFlavors.set(flavor.resourceSpecCode, {
              cpu: flavor.cpu,
              ramGiB: flavor.ramGiB,
              family: flavor.family,
              prices: {},
            });
          }
          allFlavors.get(flavor.resourceSpecCode)!.prices[region] = {
            ondemand: flavor.prices.ONDEMAND,
            monthly: flavor.prices.MONTHLY,
            ri: flavor.prices.RI,
          };
        }
      }
    }

    const sortedFlavors = Array.from(allFlavors.entries()).sort((a, b) => {
      if (a[1].family !== b[1].family) return a[1].family.localeCompare(b[1].family);
      if (a[1].cpu !== b[1].cpu) return a[1].cpu - b[1].cpu;
      return a[1].ramGiB - b[1].ramGiB;
    });

    for (const [flavorCode, flavorData] of sortedFlavors) {
      const rowData: (string | number)[] = [flavorCode, flavorData.cpu, flavorData.ramGiB, flavorData.family];

      for (const region of regions) {
        const prices = flavorData.prices[region];
        if (prices) {
          rowData.push(prices.ondemand !== undefined ? prices.ondemand : "");
          rowData.push(prices.monthly !== undefined ? prices.monthly : "");
          rowData.push(prices.ri !== undefined ? prices.ri : "");
        } else {
          rowData.push("", "", "");
        }
      }

      const row = worksheet.addRow(rowData);
      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.font = { name: "Arial", size: 10 };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };
        if (colNum <= 4) {
          cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = '"$"* #,##0.0000';
        }
      });
    }

    worksheet.getColumn(1).width = 30;
    worksheet.getColumn(2).width = 10;
    worksheet.getColumn(3).width = 12;
    worksheet.getColumn(4).width = 25;
    for (let i = 5; i <= regions.length * 3 + 4; i++) {
      worksheet.getColumn(i).width = 20;
    }
  }

  // Add Flexus L Plans sheet
  if (exportData.flexusLPlans && exportData.flexusLPlans.length > 0) {
    const sheetName = getUniqueSheetName("Flexus L Plans", usedNames);
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.views = [{ showGridLines: false }];

    const titleRow = worksheet.addRow(["Flexus L Plans"]);
    titleRow.height = 30;
    titleRow.getCell(1).font = { name: "Arial", size: 16, bold: true };
    worksheet.mergeCells("A1:G1");
    worksheet.addRow([]);

    const headers = ["Plan", "vCPUs", "RAM (GiB)", "System Disk (GiB)", "Peak Bandwidth (Mbit/s)", "Data Package (TB)", "Monthly Price (USD)"];
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "003366" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };
    });

    for (const plan of exportData.flexusLPlans) {
      const row = worksheet.addRow([
        plan.title,
        plan.vcpu,
        plan.ramGiB,
        plan.systemDiskGiB,
        plan.peakBandwidthMbit,
        plan.dataPackageTiB,
        plan.monthlyPriceUsd,
      ]);
      row.height = 22;
      row.eachCell((cell, colNum) => {
        cell.font = { name: "Arial", size: 10 };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };
        if (colNum === 1) {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        } else if (colNum === 7) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = '"$"* #,##0.00';
        } else {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });
    }

    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 10;
    worksheet.getColumn(3).width = 12;
    worksheet.getColumn(4).width = 18;
    worksheet.getColumn(5).width = 22;
    worksheet.getColumn(6).width = 18;
    worksheet.getColumn(7).width = 20;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export async function downloadFullCatalogExcel(exportData: FullCatalogExportData) {
  const serviceNames: Record<string, string> = {};
  const serviceCodes: string[] = [];

  const { serviceCatalog } = await import("@/lib/service-config");
  for (const service of serviceCatalog) {
    serviceNames[service.code] = service.name;
    serviceCodes.push(service.code);
  }

  const buffer = await buildFullCatalogWorkbookBuffer(exportData, serviceCodes, serviceNames);
  const blob = new Blob(
    [buffer],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  );

  const timestamp = new Date().toISOString().replace(/[:]/g, "-").slice(0, 19);
  return downloadBlobFile(`neocalculator-price-catalog-${timestamp}.xlsx`, blob);
}
