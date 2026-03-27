import { sendHttpRequest } from "@/lib/huawei-http";

type ProductInfoBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";

type ProductInfoSourceDefinition = {
  displayName: string;
  urlPath: string;
  tab: "calc" | "detail";
  tag?: string;
  sign?: string;
  timeoutMs?: number;
};

type PredicateDefinition =
  | { kind: "field-equals"; path: string; value: unknown }
  | { kind: "field-not-equals"; path: string; value: unknown }
  | { kind: "field-starts-with"; path: string; value: string; caseInsensitive?: boolean }
  | { kind: "field-includes"; path: string; value: string; caseInsensitive?: boolean }
  | { kind: "field-matches-regex"; path: string; pattern: string; flags?: string }
  | { kind: "text-includes"; paths: string[]; value: string; caseInsensitive?: boolean }
  | { kind: "text-excludes"; paths: string[]; value: string; caseInsensitive?: boolean };

type ExtractorDefinition =
  | { kind: "literal"; value: unknown }
  | { kind: "path"; path: string }
  | { kind: "path-or-template"; path: string; template: string }
  | { kind: "contains-map"; path: string; mappings: Array<{ contains: string; value: unknown }>; caseInsensitive?: boolean }
  | {
      kind: "keyword-map";
      directPath?: string;
      directMap?: Record<string, unknown>;
      textPaths: string[];
      mappings: Array<{ keywords: string[]; value: unknown }>;
      caseInsensitive?: boolean;
    }
  | { kind: "enum-from-pattern"; paths: string[]; values: string[]; pattern?: string; flags?: string }
  | { kind: "memory-gib"; paths: string[] }
  | { kind: "replica-count"; numberPaths: string[]; textPaths: string[]; fallbackByField?: { field: string; equals: unknown; value: unknown } }
  | { kind: "rate-set"; planPath?: string; modes: ProductInfoBillingMode[] }
  | { kind: "plan-amount"; billingMode: ProductInfoBillingMode; billingEvent?: string; planPath?: string }
  | { kind: "plan-product-id"; billingMode: ProductInfoBillingMode; planPath?: string }
  | { kind: "division-tiers"; billingMode: ProductInfoBillingMode; billingEvent: string; planPath?: string }
  | { kind: "packages"; planPath?: string; billingModes: Array<Extract<ProductInfoBillingMode, "MONTHLY" | "YEARLY">>; sizePath: string; sizeRegex: string; sizeFlags?: string }
  | {
      kind: "bandwidth-rate-per-unit";
      billingMode: ProductInfoBillingMode;
      planPath?: string;
      numberPaths: string[];
      textPaths: string[];
      textRegex?: string;
      textFlags?: string;
      defaultUnits?: number;
    };

type SectionFieldDefinition = {
  key: string;
  extractor: ExtractorDefinition;
  required?: boolean;
};

type SectionedRateSetParserDefinition = {
  kind: "sectioned-rate-set";
  currency: string;
  collectionKey: string;
  catalogStatic?: Record<string, unknown>;
  sections: Array<{
    path: string;
    fields: SectionFieldDefinition[];
  }>;
};

type SelectedCollectionDefinition = {
  id: string;
  path?: string;
  from?: string;
  filters?: PredicateDefinition[];
};

type SelectedOutputDefinition = {
  targetPath: string;
  extractor: ExtractorDefinition;
  fromCollection?: string;
  fromCollections?: string[];
  filters?: PredicateDefinition[];
};

type SelectedRecordsParserDefinition = {
  kind: "selected-records";
  currency: string;
  catalogStatic?: Record<string, unknown>;
  collections: SelectedCollectionDefinition[];
  outputs: SelectedOutputDefinition[];
};

type DerivedFieldCondition = {
  field: string;
  equals?: unknown;
  notEquals?: unknown;
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
};

type RecursiveGroupedParserDefinition = {
  kind: "recursive-grouped-records";
  currency: string;
  rootPath: string;
  collectionKey: string;
  catalogStatic?: Record<string, unknown>;
  recordFilters?: PredicateDefinition[];
  fields: SectionFieldDefinition[];
  postRejectWhenAll?: DerivedFieldCondition[][];
  dedupeBy: string[];
  minByPath: string;
  sort: Array<{ path: string; direction: "asc" | "desc"; order?: Array<string | number> }>;
  auxiliaryOutputs?: SelectedOutputDefinition[];
};

type DeclarativePricingDefinition =
  & { source: ProductInfoSourceDefinition }
  & (
    | { parser: SectionedRateSetParserDefinition }
    | { parser: SelectedRecordsParserDefinition }
    | { parser: RecursiveGroupedParserDefinition }
  );

type RawPlan = Record<string, unknown> & {
  productId?: string;
  billingMode?: string;
  billingEvent?: string;
  amount?: number;
  divisionList?: Array<Record<string, unknown> & {
    amount?: number;
    division?: Record<string, unknown> & {
      beginValue?: number;
      endValue?: number;
    };
  }>;
};

type RawRecord = Record<string, unknown> & {
  planList?: RawPlan[];
  bakPlanList?: RawPlan[];
};

const DEFAULT_HEADERS = {
  accept: "application/json, text/plain, */*",
  origin: "https://www.huaweicloud.com",
  referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
  "user-agent": "Mozilla/5.0",
} as const;

const PRODUCT_INFO_URL = "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), value);
}

function readArrayAtPath(value: unknown, path: string): RawRecord[] {
  const entries = readPath(value, path);
  return Array.isArray(entries) ? entries.filter(isRecord) as RawRecord[] : [];
}

function collectRecordsRecursive(value: unknown): RawRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => (isRecord(entry) ? [entry as RawRecord, ...collectRecordsRecursive(entry)] : collectRecordsRecursive(entry)));
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.values(value).flatMap((entry) => collectRecordsRecursive(entry));
}

function stringValues(record: RawRecord, paths: string[]) {
  return paths
    .map((path) => readPath(record, path))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function numberValues(record: RawRecord, paths: string[]) {
  return paths
    .map((path) => readPath(record, path))
    .flatMap((value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return [value];
      }
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? [parsed] : [];
      }
      return [];
    });
}

function getPlans(record: RawRecord, planPath?: string) {
  const plans = planPath ? readPath(record, planPath) : record.planList ?? record.bakPlanList;
  return Array.isArray(plans) ? plans.filter(isRecord) as RawPlan[] : [];
}

function pickPlan(record: RawRecord, billingMode: ProductInfoBillingMode, billingEvent?: string, planPath?: string) {
  return getPlans(record, planPath).find((plan) => (
    plan.billingMode === billingMode
    && typeof plan.amount === "number"
    && Number.isFinite(plan.amount)
    && (billingEvent == null || plan.billingEvent === billingEvent)
  )) ?? null;
}

function pickAmount(record: RawRecord, billingMode: ProductInfoBillingMode, billingEvent?: string, planPath?: string) {
  return pickPlan(record, billingMode, billingEvent, planPath)?.amount ?? null;
}

function buildRateSet(record: RawRecord, modes: ProductInfoBillingMode[], planPath?: string) {
  return Object.fromEntries(
    modes.map((mode) => [mode, pickAmount(record, mode, undefined, planPath) ?? undefined]),
  );
}

function parseMemoryGiB(record: RawRecord, paths: string[]) {
  for (const value of paths.map((path) => readPath(record, path))) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value >= 1024 ? value / 1024 : value;
    }

    if (typeof value === "string" && value.trim()) {
      const direct = Number(value);
      if (Number.isFinite(direct) && direct > 0) {
        return direct >= 1024 ? direct / 1024 : direct;
      }

      const leading = value.match(/^(\d+(?:\.\d+)?)/);
      if (leading) {
        const parsed = Number(leading[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
          return /mb/i.test(value) ? parsed / 1024 : parsed;
        }
      }

      const gbMatch = value.match(/(\d+(?:\.\d+)?)\s*gb/i);
      if (gbMatch) {
        return Number(gbMatch[1]);
      }
      const mbMatch = value.match(/(\d+(?:\.\d+)?)\s*mb/i);
      if (mbMatch) {
        return Number(mbMatch[1]) / 1024;
      }
    }
  }

  return null;
}

function buildTemplate(template: string, fields: Record<string, unknown>) {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => String(fields[key] ?? ""));
}

function matchesPredicate(record: RawRecord, predicate: PredicateDefinition) {
  if (predicate.kind === "field-equals") {
    return readPath(record, predicate.path) === predicate.value;
  }
  if (predicate.kind === "field-not-equals") {
    return readPath(record, predicate.path) !== predicate.value;
  }
  if (predicate.kind === "text-includes" || predicate.kind === "text-excludes") {
    const text = stringValues(record, predicate.paths).join(" ");
    const haystack = predicate.caseInsensitive === false ? text : text.toLowerCase();
    const needle = predicate.caseInsensitive === false ? predicate.value : predicate.value.toLowerCase();
    return predicate.kind === "text-includes" ? haystack.includes(needle) : !haystack.includes(needle);
  }

  const rawValue = readPath(record, predicate.path);
  if (predicate.kind === "field-starts-with") {
    if (typeof rawValue !== "string") {
      return false;
    }
    const haystack = predicate.caseInsensitive ? rawValue.toLowerCase() : rawValue;
    const needle = predicate.caseInsensitive ? predicate.value.toLowerCase() : predicate.value;
    return haystack.startsWith(needle);
  }
  if (predicate.kind === "field-includes") {
    if (typeof rawValue !== "string") {
      return false;
    }
    const haystack = predicate.caseInsensitive ? rawValue.toLowerCase() : rawValue;
    const needle = predicate.caseInsensitive ? predicate.value.toLowerCase() : predicate.value;
    return haystack.includes(needle);
  }
  if (predicate.kind === "field-matches-regex") {
    return typeof rawValue === "string" && new RegExp(predicate.pattern, predicate.flags).test(rawValue);
  }
  return false;
}

function extractValue(record: RawRecord, extractor: ExtractorDefinition, fields: Record<string, unknown> = {}) {
  switch (extractor.kind) {
    case "literal":
      return extractor.value;
    case "path":
      return readPath(record, extractor.path);
    case "path-or-template": {
      const value = readPath(record, extractor.path);
      if (typeof value === "string" && value) {
        return value;
      }
      return buildTemplate(extractor.template, fields);
    }
    case "contains-map": {
      const rawValue = readPath(record, extractor.path);
      if (typeof rawValue !== "string") {
        return null;
      }
      const haystack = extractor.caseInsensitive === false ? rawValue : rawValue.toLowerCase();
      for (const mapping of extractor.mappings) {
        const needle = extractor.caseInsensitive === false ? mapping.contains : mapping.contains.toLowerCase();
        if (haystack.includes(needle)) {
          return mapping.value;
        }
      }
      return null;
    }
    case "keyword-map": {
      if (extractor.directPath && extractor.directMap) {
        const directValue = readPath(record, extractor.directPath);
        if (typeof directValue === "string" && directValue in extractor.directMap) {
          return extractor.directMap[directValue];
        }
      }
      const text = stringValues(record, extractor.textPaths).join(" ");
      const haystack = extractor.caseInsensitive === false ? text : text.toLowerCase();
      for (const mapping of extractor.mappings) {
        const matched = mapping.keywords.every((keyword) => haystack.includes(extractor.caseInsensitive === false ? keyword : keyword.toLowerCase()));
        if (matched) {
          return mapping.value;
        }
      }
      return null;
    }
    case "enum-from-pattern": {
      const text = stringValues(record, extractor.paths).join(" ");
      for (const value of extractor.values) {
        const pattern = extractor.pattern ?? `(?:^|[^0-9])(${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?:[^0-9]|$)`;
        const match = text.match(new RegExp(pattern.replace("${value}", value), extractor.flags));
        if (match) {
          return value;
        }
      }
      return null;
    }
    case "memory-gib":
      return parseMemoryGiB(record, extractor.paths);
    case "replica-count": {
      for (const value of numberValues(record, extractor.numberPaths)) {
        if (value > 0) {
          return Math.floor(value);
        }
      }
      const text = stringValues(record, extractor.textPaths).join(" ");
      const keywordMatch = text.match(/(?:replica|standby|slave)[^\d]*(\d+)/i) ?? text.match(/(?:^|\.|_)([1-6])rep(?:lica)?(?:\.|_|$)/i);
      if (keywordMatch) {
        const parsed = Number(keywordMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
          return Math.floor(parsed);
        }
      }
      if (extractor.fallbackByField && fields[extractor.fallbackByField.field] === extractor.fallbackByField.equals) {
        return extractor.fallbackByField.value;
      }
      return null;
    }
    case "rate-set":
      return buildRateSet(record, extractor.modes, extractor.planPath);
    case "plan-amount":
      return pickAmount(record, extractor.billingMode, extractor.billingEvent, extractor.planPath);
    case "plan-product-id":
      return pickPlan(record, extractor.billingMode, undefined, extractor.planPath)?.productId ?? null;
    case "division-tiers": {
      const plan = pickPlan(record, extractor.billingMode, extractor.billingEvent, extractor.planPath);
      return (plan?.divisionList ?? [])
        .map((tier) => {
          if (typeof tier.amount !== "number" || !Number.isFinite(tier.amount)) {
            return null;
          }
          return {
            startGb: typeof tier.division?.beginValue === "number" ? Math.max(0, tier.division.beginValue) : 0,
            upToGb: typeof tier.division?.endValue === "number" && tier.division.endValue >= 0 ? tier.division.endValue : null,
            amountPerGb: tier.amount,
          };
        })
        .filter((entry): entry is { startGb: number; upToGb: number | null; amountPerGb: number } => entry != null)
        .sort((left, right) => left.startGb - right.startGb);
    }
    case "packages": {
      const sizeValue = readPath(record, extractor.sizePath);
      const sizeText = typeof sizeValue === "string" ? sizeValue : "";
      const sizeMatch = sizeText.match(new RegExp(extractor.sizeRegex, extractor.sizeFlags));
      if (!sizeMatch) {
        return [];
      }
      const sizeGb = Number(sizeMatch[1]);
      if (!Number.isFinite(sizeGb) || sizeGb <= 0) {
        return [];
      }

      return getPlans(record, extractor.planPath)
        .filter((plan): plan is RawPlan & { billingMode: "MONTHLY" | "YEARLY"; amount: number } => (
          (plan.billingMode === "MONTHLY" || plan.billingMode === "YEARLY")
          && extractor.billingModes.includes(plan.billingMode)
          && typeof plan.amount === "number"
          && Number.isFinite(plan.amount)
        ))
        .map((plan) => ({
          billingMode: plan.billingMode,
          sizeGb,
          amount: plan.amount,
          resourceSpecCode: sizeText,
          productId: typeof plan.productId === "string" ? plan.productId : null,
        }));
    }
    case "bandwidth-rate-per-unit": {
      const amount = pickAmount(record, extractor.billingMode, undefined, extractor.planPath);
      if (amount == null) {
        return null;
      }
      for (const value of numberValues(record, extractor.numberPaths)) {
        if (value > 0) {
          return amount / value;
        }
      }
      const text = stringValues(record, extractor.textPaths).join(" ");
      const match = extractor.textRegex ? text.match(new RegExp(extractor.textRegex, extractor.textFlags)) : null;
      if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
          return amount / parsed;
        }
      }
      const defaultUnits = extractor.defaultUnits ?? 1;
      return defaultUnits > 0 ? amount / defaultUnits : null;
    }
  }
}

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let current: Record<string, unknown> = target;
  for (const part of parts.slice(0, -1)) {
    const existing = current[part];
    if (!isRecord(existing)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1) as string] = value;
}

function compareByRule(left: Record<string, unknown>, right: Record<string, unknown>, rule: RecursiveGroupedParserDefinition["sort"][number]) {
  const leftValue = readPath(left, rule.path);
  const rightValue = readPath(right, rule.path);
  let comparison = 0;

  if (rule.order) {
    comparison = rule.order.indexOf(leftValue as never) - rule.order.indexOf(rightValue as never);
  } else if (typeof leftValue === "number" && typeof rightValue === "number") {
    comparison = leftValue - rightValue;
  } else {
    comparison = String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
  }

  return rule.direction === "desc" ? -comparison : comparison;
}

function rejectByDerivedConditions(fields: Record<string, unknown>, conditions: DerivedFieldCondition[][] | undefined) {
  if (!conditions?.length) {
    return false;
  }

  return conditions.some((allConditions) => allConditions.every((condition) => {
    const value = readPath(fields, condition.field);
    if (condition.equals !== undefined && value !== condition.equals) return false;
    if (condition.notEquals !== undefined && value === condition.notEquals) return false;
    if (condition.lt !== undefined && !(typeof value === "number" && value < condition.lt)) return false;
    if (condition.lte !== undefined && !(typeof value === "number" && value <= condition.lte)) return false;
    if (condition.gt !== undefined && !(typeof value === "number" && value > condition.gt)) return false;
    if (condition.gte !== undefined && !(typeof value === "number" && value >= condition.gte)) return false;
    return true;
  }));
}

async function fetchProductInfoBody(source: ProductInfoSourceDefinition, regionId: string) {
  const url = new URL(PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", source.urlPath);
  url.searchParams.set("tag", source.tag ?? "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", source.tab);
  url.searchParams.set("sign", source.sign ?? "common");

  const response = await sendHttpRequest({
    method: "GET",
    url: url.toString(),
    headers: DEFAULT_HEADERS,
    timeoutMs: source.timeoutMs ?? 30_000,
  });

  if (!response.ok) {
    throw new Error(`${source.displayName} product info request failed: ${response.status} ${response.statusText}`);
  }
  if (!response.bodyText.trim()) {
    throw new Error(`${source.displayName} product info response was empty`);
  }

  try {
    return JSON.parse(response.bodyText);
  } catch {
    throw new Error(`${source.displayName} product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }
}

function parseSectionedRateSetCatalog(definition: Extract<DeclarativePricingDefinition["parser"], { kind: "sectioned-rate-set" }>, body: unknown, regionId: string) {
  const records: Record<string, unknown>[] = [];

  for (const section of definition.sections) {
    for (const record of readArrayAtPath(body, section.path)) {
      const fields: Record<string, unknown> = {};
      let valid = true;
      for (const field of section.fields) {
        const value = extractValue(record, field.extractor, fields);
        if (field.required && (value == null || value === "")) {
          valid = false;
          break;
        }
        fields[field.key] = value;
      }
      if (valid) {
        records.push(fields);
      }
    }
  }

  return {
    currency: definition.currency,
    regionId,
    ...(definition.catalogStatic ?? {}),
    [definition.collectionKey]: records,
  };
}

function parseSelectedRecordsCatalog(definition: Extract<DeclarativePricingDefinition["parser"], { kind: "selected-records" }>, body: unknown, regionId: string) {
  const collections: Record<string, RawRecord[]> = {};

  for (const collection of definition.collections) {
    const baseRecords = collection.path
      ? readArrayAtPath(body, collection.path)
      : (collection.from ? collections[collection.from] ?? [] : []);
    collections[collection.id] = collection.filters?.length
      ? baseRecords.filter((record) => collection.filters?.every((predicate) => matchesPredicate(record, predicate)))
      : baseRecords;
  }

  const catalog: Record<string, unknown> = {
    currency: definition.currency,
    regionId,
    ...(definition.catalogStatic ?? {}),
  };

  for (const output of definition.outputs) {
    const sourceRecords = output.fromCollections
      ? output.fromCollections.flatMap((collectionId) => collections[collectionId] ?? []).slice(0, 1)
      : output.fromCollection
      ? collections[output.fromCollection] ?? []
      : [];
    const filteredRecords = output.filters?.length ? sourceRecords.filter((record) => output.filters?.every((predicate) => matchesPredicate(record, predicate))) : sourceRecords;
    const extracted = output.extractor.kind === "packages"
      ? filteredRecords.flatMap((record) => extractValue(record, output.extractor) as unknown[])
      : extractValue(filteredRecords[0] ?? {}, output.extractor);
    setNestedValue(catalog, output.targetPath, extracted);
  }

  return catalog;
}

function parseRecursiveGroupedCatalog(definition: Extract<DeclarativePricingDefinition["parser"], { kind: "recursive-grouped-records" }>, body: unknown, regionId: string) {
  const root = readPath(body, definition.rootPath);
  const records = collectRecordsRecursive(root);
  const itemsByKey = new Map<string, Record<string, unknown>>();

  for (const record of records) {
    if (definition.recordFilters?.some((predicate) => !matchesPredicate(record, predicate))) {
      continue;
    }

    const fields: Record<string, unknown> = {};
    let valid = true;
    for (const field of definition.fields) {
      const value = extractValue(record, field.extractor, fields);
      if (field.required && (value == null || value === "")) {
        valid = false;
        break;
      }
      fields[field.key] = value;
    }
    if (!valid || rejectByDerivedConditions(fields, definition.postRejectWhenAll)) {
      continue;
    }

    const key = definition.dedupeBy.map((field) => String(readPath(fields, field) ?? "")).join("|");
    const existing = itemsByKey.get(key);
    const currentValue = readPath(fields, definition.minByPath);
    const existingValue = existing ? readPath(existing, definition.minByPath) : undefined;
    if (!existing || (typeof currentValue === "number" && typeof existingValue === "number" && currentValue < existingValue)) {
      itemsByKey.set(key, fields);
    }
  }

  const items = [...itemsByKey.values()].sort((left, right) => {
    for (const rule of definition.sort) {
      const comparison = compareByRule(left, right, rule);
      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  });

  const catalog: Record<string, unknown> = {
    currency: definition.currency,
    regionId,
    ...(definition.catalogStatic ?? {}),
    [definition.collectionKey]: items,
  };

  for (const output of definition.auxiliaryOutputs ?? []) {
    const sourceRecords = output.filters?.length ? records.filter((record) => output.filters?.every((predicate) => matchesPredicate(record, predicate))) : records;
    let bestValue: number | null = null;
    if (output.extractor.kind === "bandwidth-rate-per-unit") {
      for (const record of sourceRecords) {
        const value = extractValue(record, output.extractor);
        if (typeof value === "number" && Number.isFinite(value) && (bestValue == null || value < bestValue)) {
          bestValue = value;
        }
      }
      setNestedValue(catalog, output.targetPath, bestValue);
      continue;
    }

    setNestedValue(catalog, output.targetPath, null);
  }

  return catalog;
}

export async function fetchDeclarativePricingCatalog<T>(definition: DeclarativePricingDefinition, regionId: string): Promise<T> {
  const body = await fetchProductInfoBody(definition.source, regionId);
  return parseDeclarativePricingCatalog<T>(definition, body, regionId);
}

export function parseDeclarativePricingCatalog<T>(definition: DeclarativePricingDefinition, body: unknown, regionId: string): T {
  switch (definition.parser.kind) {
    case "sectioned-rate-set":
      return parseSectionedRateSetCatalog(definition.parser, body, regionId) as T;
    case "selected-records":
      return parseSelectedRecordsCatalog(definition.parser, body, regionId) as T;
    case "recursive-grouped-records":
      return parseRecursiveGroupedCatalog(definition.parser, body, regionId) as T;
  }
}

export type {
  DeclarativePricingDefinition,
  DerivedFieldCondition,
  ExtractorDefinition,
  PredicateDefinition,
  ProductInfoBillingMode,
  ProductInfoSourceDefinition,
  SectionFieldDefinition,
};
