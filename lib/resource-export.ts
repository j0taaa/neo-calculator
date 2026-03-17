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

function stringifyJson(value: unknown) {
  if (value == null) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getPricingSummary(pricing: unknown) {
  if (isRecord(pricing) && typeof pricing.total === "string" && pricing.total.trim()) {
    return pricing.total.trim();
  }

  if (isRecord(pricing) && typeof pricing.amount === "number" && Number.isFinite(pricing.amount)) {
    const currency = typeof pricing.currency === "string" && pricing.currency.trim() ? pricing.currency.trim() : "USD";
    const suffix = typeof pricing.suffix === "string" ? pricing.suffix : "";
    return `${currency} ${pricing.amount.toFixed(4)}${suffix}`;
  }

  return "";
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

export async function buildProjectWorkbookBuffer(project: ExportProjectLike) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  if (!project.lists.length) {
    const emptySheet = XLSX.utils.json_to_sheet([
      {
        Project: project.name,
        Note: "This project has no carts to export.",
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, emptySheet, getUniqueSheetName("Project", usedNames));
    return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  }

  project.lists.forEach((list) => {
    const rows = list.products.length
      ? list.products.map((product, index) => ({
          Index: index + 1,
          Project: project.name,
          Cart: list.name,
          Service: product.serviceName,
          ServiceCode: product.serviceCode,
          ProductType: product.productType,
          Title: product.title,
          Quantity: product.quantity,
          Specs: getConfigSpecsSummary(product.config),
          PricingSummary: getPricingSummary(product.pricing),
          ConfigJson: stringifyJson(product.config),
          PricingJson: stringifyJson(product.pricing),
          CreatedAt: product.createdAt ?? "",
          UpdatedAt: product.updatedAt ?? "",
        }))
      : [
          {
            Index: 1,
            Project: project.name,
            Cart: list.name,
            Service: "",
            ServiceCode: "",
            ProductType: "",
            Title: "",
            Quantity: 0,
            Specs: "",
            PricingSummary: "",
            ConfigJson: "",
            PricingJson: "",
            CreatedAt: "",
            UpdatedAt: "",
            Note: "This cart has no saved resources.",
          },
        ];

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 8 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 16 },
      { wch: 18 },
      { wch: 30 },
      { wch: 10 },
      { wch: 30 },
      { wch: 20 },
      { wch: 36 },
      { wch: 36 },
      { wch: 24 },
      { wch: 24 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, getUniqueSheetName(list.name, usedNames));
  });

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export async function downloadProjectWorkbookFile(project: ExportProjectLike) {
  const buffer = await buildProjectWorkbookBuffer(project);
  const blob = new Blob(
    [buffer],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  );
  return downloadBlobFile(
    buildNamedExportFilename("project", project.name, "xlsx"),
    blob,
  );
}
