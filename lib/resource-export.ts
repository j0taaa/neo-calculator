import { huaweiRegions } from "@/lib/huawei-regions";

type ExportProductLike = {
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

type ExportListLike = {
  name: string;
  products: ExportProductLike[];
};

type ExportProjectLike = {
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

function getConfigSpecsSummary(config: unknown) {
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

function getRegionFromConfig(config: unknown): string {
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

function getDescriptionFromConfig(config: unknown, fallback: string): string {
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

function getMonthlyPrice(pricing: unknown): number | null {
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

export async function buildProjectWorkbookBuffer(project: ExportProjectLike, shareUrl?: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();

  if (!project.lists.length) {
    const worksheet = workbook.addWorksheet(getUniqueSheetName("Project", usedNames));
    worksheet.addRow(["Project", project.name]);
    worksheet.addRow(["Note", "This project has no carts to export."]);
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
  }

  // Create Summary sheet first
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.views = [{ showGridLines: false }];

  // Summary sheet column widths
  summarySheet.columns = [
    { width: 8 },       // A: No
    { width: 32 },      // B: Name
    { width: 25.85 },   // C: Yearly Price (US$) - 345 pixels
    { width: 25.85 },   // D: Monthly Price (US$) - 345 pixels
  ];

  // Summary title row
  const summaryTitleRow = summarySheet.addRow([`${project.name} - Huawei Cloud`]);
  summaryTitleRow.height = 34.80;
  summarySheet.mergeCells("A1:D1");
  summaryTitleRow.getCell(1).font = { name: "Arial", size: 20, bold: true };
  summaryTitleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  summaryTitleRow.getCell(1).border = {
    top: { style: "thin", color: { argb: "000000" } },
    bottom: { style: "thin", color: { argb: "000000" } },
    left: { style: "thin", color: { argb: "000000" } },
    right: { style: "thin", color: { argb: "000000" } },
  };

  // Summary header row
  const summaryHeaders = ["No", "Name", "Yearly Price (US$)", "Monthly Price (US$)"];
  const summaryHeaderRow = summarySheet.addRow(summaryHeaders);
  summaryHeaderRow.height = 34.80;
  summaryHeaderRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "003366" } };
    cell.border = {
      top: { style: "thin", color: { argb: "000000" } },
      bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } },
      right: { style: "thin", color: { argb: "000000" } },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Summary data rows - we'll add formulas after creating individual sheets
  const summaryDataRowCount = project.lists.length;
  project.lists.forEach((list, index) => {
    const row = summarySheet.addRow([
      index + 1,
      list.name,
      0, // Placeholder, will be replaced with formula
      0, // Placeholder, will be replaced with formula
    ]);
    row.height = 34.80;

    row.eachCell((cell, colNum) => {
      cell.font = { name: "Arial", size: 14 };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };

      if (colNum === 1) { // No
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNum === 2) { // Name
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNum === 3 || colNum === 4) { // Prices - accounting format
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = '"$"* #,##0.00';
      }
    });
  });

  // Add hyperlink row
  const linkRowNum = summaryDataRowCount + 3;
  const linkRow = summarySheet.addRow(["Open project in calculator"]);
  linkRow.height = 34.80;
  summarySheet.mergeCells(`A${linkRowNum}:D${linkRowNum}`);
  const linkCell = linkRow.getCell(1);
  linkCell.font = { name: "Arial", size: 14, color: { argb: "0563C1" }, underline: "single" };
  linkCell.alignment = { horizontal: "center", vertical: "middle" };
  linkCell.border = {
    top: { style: "thin", color: { argb: "000000" } },
    bottom: { style: "thin", color: { argb: "000000" } },
    left: { style: "thin", color: { argb: "000000" } },
    right: { style: "thin", color: { argb: "000000" } },
  };
  // Hyperlink will be set after we know the sheet names

  // First pass: create all worksheets and track their info
  const listSheetInfo: Array<{ name: string; totalRowNum: number | null }> = [];

  project.lists.forEach((list) => {
    const sheetName = getUniqueSheetName(list.name, usedNames);
    const worksheet = workbook.addWorksheet(sheetName);
    listSheetInfo.push({ name: sheetName, totalRowNum: null });

    // Hide gridlines by default
    worksheet.views = [{ showGridLines: false }];

    if (!list.products.length) {
      const emptyHeaderRow = worksheet.addRow(["No", "Service", "Region", "Specifications", "Quantity", "Monthly Price", "Yearly Price", "Comments"]);
      emptyHeaderRow.height = 34.80;
      const emptyRow1 = worksheet.addRow(["", "", "", "", "", "", "", ""]);
      emptyRow1.height = 34.80;
      const emptyRow2 = worksheet.addRow(["", "This cart has no saved resources.", "", "", "", "", "", ""]);
      emptyRow2.height = 34.80;
      return;
    }

    const dataRowCount = list.products.length;
    const totalRowNum = 3 + dataRowCount; // Row 1=title, Row 2=header, Row 3+ = data, last row = total

    // Track this sheet's info for Summary formulas
    listSheetInfo[listSheetInfo.length - 1] = { name: sheetName, totalRowNum };

    // Set column widths
    worksheet.columns = [
      { width: 6 },       // A: No
      { width: 32 },      // B: Service
      { width: 14 },      // C: Region
      { width: 45 },      // D: Specifications
      { width: 11.31 },   // E: Quantity (156 pixels)
      { width: 20.31 },   // F: Monthly Price (231 pixels)
      { width: 20.31 },   // G: Yearly Price (273 pixels)
      { width: 20 },      // H: Comments
    ];

    // Title row (row 1) - merged A1:H1
    const titleRow = worksheet.addRow([list.name]);
    titleRow.height = 34.80;
    worksheet.mergeCells("A1:H1");
    titleRow.getCell(1).font = { name: "Arial", size: 20, bold: true };
    titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    titleRow.getCell(1).border = {
      top: { style: "thin", color: { argb: "000000" } },
      bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } },
      right: { style: "thin", color: { argb: "000000" } },
    };

    // Header row (row 2) - blue background, white bold text
    const headers = ["No", "Service", "Region", "Specifications", "Quantity", "Monthly Price", "Yearly Price", "Comments"];
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 34.80;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "003366" } };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Data rows (row 3 onwards)
    list.products.forEach((product, index) => {
      const monthlyPrice = getMonthlyPrice(product.pricing);
      const specs = getConfigSpecsSummary(product.config);
      const title = product.title || "";
      const specifications = title + (specs ? ` | ${specs}` : "");
      const quantity = product.quantity || 1;
      const excelRowNum = index + 3;

      const row = worksheet.addRow([
        index + 1,                                          // No
        getDescriptionFromConfig(product.config, product.serviceName), // Service (description or service name)
        getRegionFromConfig(product.config),                // Region
        specifications,                                     // Specifications
        quantity,                                           // Quantity
        monthlyPrice ?? 0,                                  // Monthly Price
        { formula: `F${excelRowNum}*12` },                  // Yearly Price formula
        "",                                                 // Comments
      ]);
      row.height = 34.80;

      // Apply styling to each cell
      row.eachCell((cell, colNum) => {
        cell.font = { name: "Arial", size: 14 };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        // Column-specific styling
        if (colNum === 1 || colNum === 5) { // No, Quantity
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (colNum === 3) { // Region - centered with wrap text
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        } else if (colNum === 4) { // Specifications - left with wrap text
          cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        } else if (colNum === 6 || colNum === 7) { // Monthly Price, Yearly Price - accounting format
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = '"$"* #,##0.00';
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
    });

    // Total row
    const totalRow = worksheet.addRow([
      "Total", // No column (will be merged with B, C, D, E)
      "",      // Service
      "",      // Region
      "",      // Specifications
      "",      // Quantity
      { formula: `SUM(F3:F${totalRowNum - 1})` }, // Monthly Price Total
      { formula: `SUM(G3:G${totalRowNum - 1})` }, // Yearly Price Total
      "",      // Comments
    ]);
    totalRow.height = 34.80;

    // Merge cells A:E in Total row
    worksheet.mergeCells(`A${totalRowNum}:E${totalRowNum}`);

    // Style Total row
    totalRow.eachCell((cell, colNum) => {
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };

      if (colNum === 1) { // Total label (now in column A)
        cell.font = { name: "Arial", size: 14, bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colNum === 6 || colNum === 7) { // Totals - accounting format
        cell.font = { name: "Arial", size: 14, bold: true };
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = '"$"* #,##0.00';
      }
    });
  });

  // Second pass: Update Summary sheet with formulas referencing individual sheets
  const summaryDataStartRow = 3;
  project.lists.forEach((list, index) => {
    const sheetInfo = listSheetInfo[index];
    if (sheetInfo?.totalRowNum != null) {
      const summaryRowNum = summaryDataStartRow + index;
      // Yearly Price formula: ='SheetName'!G{totalRowNum}
      const yearlyPriceCell = summarySheet.getCell(summaryRowNum, 3);
      yearlyPriceCell.value = { formula: `'${sheetInfo.name}'!G${sheetInfo.totalRowNum}` };
      yearlyPriceCell.numFmt = '"$"* #,##0.00';

      // Monthly Price formula: ='SheetName'!F{totalRowNum}
      const monthlyPriceCell = summarySheet.getCell(summaryRowNum, 4);
      monthlyPriceCell.value = { formula: `'${sheetInfo.name}'!F${sheetInfo.totalRowNum}` };
      monthlyPriceCell.numFmt = '"$"* #,##0.00';
    } else {
      const summaryRowNum = summaryDataStartRow + index;
      summarySheet.getCell(summaryRowNum, 3).value = 0;
      summarySheet.getCell(summaryRowNum, 4).value = 0;
    }
  });

  // Update hyperlink cell (cell was already created earlier)
  const finalLinkRowNum = project.lists.length + 3;
  const finalLinkCell = summarySheet.getCell(finalLinkRowNum, 1);
  // Use the provided shareUrl or fallback to a placeholder message
  if (shareUrl) {
    finalLinkCell.value = { text: "Open project in calculator", hyperlink: shareUrl };
  } else {
    // If no share URL provided, just show text without hyperlink
    finalLinkCell.value = "Open project in calculator";
    finalLinkCell.font = { name: "Arial", size: 14, color: { argb: "666666" } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export async function downloadProjectWorkbookFile(project: ExportProjectLike, shareUrl?: string) {
  const buffer = await buildProjectWorkbookBuffer(project, shareUrl);
  const blob = new Blob(
    [buffer],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  );
  return downloadBlobFile(
    buildNamedExportFilename("project", project.name, "xlsx"),
    blob,
  );
}

// Types for full catalog export
type CatalogTier = {
  resourceSpecCode?: string;
  plans?: Array<{
    billingMode?: string;
    periodNum?: number | null;
    amount?: number;
    tiers?: Array<{
      start?: number;
      end?: number | null;
      amount?: number;
    }>;
  }>;
  [key: string]: unknown;
};

type CatalogData = {
  gateways?: CatalogTier[];
  publicBandwidth?: CatalogTier[];
  tiers?: CatalogTier[];
  disks?: CatalogTier[];
  volumes?: CatalogTier[];
  [key: string]: unknown;
};

type FullCatalogExportData = {
  regions: string[];
  catalogs: Record<string, Record<string, CatalogData>>;
  generatedAt: string;
};

// Extract pricing tiers from catalog data for a component
function extractCatalogComponentTiers(catalog: CatalogData, componentKey: string): CatalogTier[] {
  const keys = componentKey.split(".");
  let current: unknown = catalog;

  for (const key of keys) {
    if (typeof current !== "object" || current === null) {
      return [];
    }
    current = (current as Record<string, unknown>)[key];
  }

  if (!Array.isArray(current)) {
    return [];
  }

  return current as CatalogTier[];
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

  // Style constants
  const headerStyle = {
    font: { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } },
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "003366" } },
    alignment: { horizontal: "center" as const, vertical: "middle" as const },
    border: {
      top: { style: "thin" as const, color: { argb: "000000" } },
      bottom: { style: "thin" as const, color: { argb: "000000" } },
      left: { style: "thin" as const, color: { argb: "000000" } },
      right: { style: "thin" as const, color: { argb: "000000" } },
    },
  };

  const dataStyle = {
    font: { name: "Arial", size: 10 },
    border: {
      top: { style: "thin" as const, color: { argb: "000000" } },
      bottom: { style: "thin" as const, color: { argb: "000000" } },
      left: { style: "thin" as const, color: { argb: "000000" } },
      right: { style: "thin" as const, color: { argb: "000000" } },
    },
  };

  // For each service
  for (const serviceCode of serviceCodes) {
    const catalogs = exportData.catalogs[serviceCode];
    if (!catalogs || Object.keys(catalogs).length === 0) {
      continue;
    }

    const serviceName = serviceNames[serviceCode] || serviceCode;
    const sheetName = getUniqueSheetName(serviceName, usedNames);
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.views = [{ showGridLines: false }];

    // Title row
    const titleRow = worksheet.addRow([serviceName]);
    titleRow.height = 30;
    titleRow.getCell(1).font = { name: "Arial", size: 16, bold: true };
    titleRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    worksheet.mergeCells(`A${titleRow.number}:${String.fromCharCode(65 + regions.length)}${titleRow.number}`);

    // Empty row
    worksheet.addRow([]);

    // Get the first non-null catalog to determine structure
    const firstCatalog = Object.values(catalogs)[0] as CatalogData;
    if (!firstCatalog) continue;

    // Determine which components this service has
    const componentKeys: Array<{ key: string; label: string }> = [];

    if (firstCatalog.gateways && firstCatalog.gateways.length > 0) {
      componentKeys.push({ key: "gateways", label: "Gateway" });
    }
    if (firstCatalog.publicBandwidth && firstCatalog.publicBandwidth.length > 0) {
      componentKeys.push({ key: "publicBandwidth", label: "Public Bandwidth" });
    }
    if (firstCatalog.tiers && firstCatalog.tiers.length > 0) {
      componentKeys.push({ key: "tiers", label: "Tiers" });
    }
    if (firstCatalog.disks && firstCatalog.disks.length > 0) {
      componentKeys.push({ key: "disks", label: "Disks" });
    }
    if (firstCatalog.volumes && firstCatalog.volumes.length > 0) {
      componentKeys.push({ key: "volumes", label: "Volumes" });
    }

    // Check for other array properties that might be pricing components
    for (const [key, value] of Object.entries(firstCatalog)) {
      if (Array.isArray(value) && value.length > 0 && !["gateways", "publicBandwidth", "tiers", "disks", "volumes"].includes(key)) {
        componentKeys.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1) });
      }
    }

    // If no specific components found, use the whole catalog as one component
    if (componentKeys.length === 0) {
      componentKeys.push({ key: "root", label: "Pricing" });
    }

    // For each component, create a table
    for (const component of componentKeys) {
      // Component header row
      const componentHeaderRow = worksheet.addRow([component.label]);
      componentHeaderRow.height = 25;
      componentHeaderRow.getCell(1).font = { name: "Arial", size: 12, bold: true, color: { argb: "003366" } };
      worksheet.mergeCells(`A${componentHeaderRow.number}:${String.fromCharCode(65 + regions.length)}${componentHeaderRow.number}`);

      // Build headers: Specification | Region1 | Region2 | ...
      const headers = ["Specification"];
      for (const region of regions) {
        const regionInfo = huaweiRegions[region as keyof typeof huaweiRegions];
        headers.push(regionInfo?.short || region);
      }

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        Object.assign(cell, headerStyle);
      });

      // Collect all tiers from all regions
      const allTiers = new Map<string, Map<string, { ondemand?: number; monthly?: number; yearly?: number; ri?: number }>>();

      for (const region of regions) {
        const catalog = catalogs[region] as CatalogData;
        if (!catalog) continue;

        const tiers = component.key === "root"
          ? [{ resourceSpecCode: "default" } as CatalogTier]
          : extractCatalogComponentTiers(catalog, component.key);

        for (const tier of tiers) {
          const specCode = String(tier.resourceSpecCode || (tier as Record<string, unknown>).specification || "default");
          if (!allTiers.has(specCode)) {
            allTiers.set(specCode, new Map<string, { ondemand?: number; monthly?: number; yearly?: number; ri?: number }>());
          }

          const regionPrices = allTiers.get(specCode)!;
          if (!regionPrices.has(region)) {
            regionPrices.set(region, {});
          }

          const prices = regionPrices.get(region)!;

          // Extract prices from plans
          if (tier.plans && Array.isArray(tier.plans)) {
            for (const plan of tier.plans) {
              const billingMode = plan.billingMode?.toUpperCase();
              if (billingMode === "ONDEMAND" || billingMode === "PAY-PER-USE") {
                if (plan.amount !== undefined) {
                  prices.ondemand = plan.amount;
                }
                // Check for tiered pricing
                if (plan.tiers && plan.tiers.length > 0) {
                  const flatTier = plan.tiers.find(t => t.start === 0 && (t.end === null || t.end === undefined));
                  if (flatTier) {
                    prices.ondemand = flatTier.amount;
                  }
                }
              } else if (billingMode === "MONTHLY") {
                prices.monthly = plan.amount;
              } else if (billingMode === "YEARLY") {
                prices.yearly = plan.amount;
              } else if (billingMode === "RI") {
                prices.ri = plan.amount;
              }
            }
          }

          // Check for direct amount/price properties
          if (typeof tier.amount === "number") {
            prices.ondemand = tier.amount;
          }
          if (typeof tier.price === "number") {
            prices.ondemand = tier.price as number;
          }
        }
      }

      // Add data rows for each tier
      for (const [specCode, regionPrices] of allTiers) {
        const row = worksheet.addRow([specCode]);
        row.height = 22;

        // For each region, add pricing info
        for (let i = 0; i < regions.length; i++) {
          const region = regions[i];
          const prices = regionPrices.get(region);

          if (prices) {
            const priceParts: string[] = [];
            if (prices.ondemand !== undefined) {
              priceParts.push(`Pay-per-use: $${prices.ondemand.toFixed(4)}`);
            }
            if (prices.monthly !== undefined) {
              priceParts.push(`Monthly: $${prices.monthly.toFixed(4)}`);
            }
            if (prices.yearly !== undefined) {
              priceParts.push(`Yearly: $${prices.yearly.toFixed(4)}`);
            }
            if (prices.ri !== undefined) {
              priceParts.push(`RI: $${prices.ri.toFixed(4)}`);
            }

            row.getCell(i + 2).value = priceParts.join("\n") || "N/A";
          } else {
            row.getCell(i + 2).value = "N/A";
          }
        }

        // Apply styling
        row.eachCell((cell, colNum) => {
          Object.assign(cell, dataStyle);
          cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "top", wrapText: true };
        });
      }

      // If no tiers found, add a note
      if (allTiers.size === 0) {
        const noteRow = worksheet.addRow(["No pricing data available"]);
        noteRow.getCell(1).font = { name: "Arial", size: 10, italic: true, color: { argb: "666666" } };
        worksheet.mergeCells(`A${noteRow.number}:${String.fromCharCode(65 + regions.length)}${noteRow.number}`);
      }

      // Empty row after table
      worksheet.addRow([]);
    }

    // Set column widths
    worksheet.getColumn(1).width = 30;
    for (let i = 2; i <= regions.length + 1; i++) {
      worksheet.getColumn(i).width = 35;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

// Download full catalog as Excel
export async function downloadFullCatalogExcel(exportData: FullCatalogExportData) {
  // Get service info from service catalog
  const serviceNames: Record<string, string> = {};
  const serviceCodes: string[] = [];

  // Import service catalog dynamically to avoid circular dependencies
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
