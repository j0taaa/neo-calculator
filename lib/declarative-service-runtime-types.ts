export type DeclarativeCatalogSource = {
  route: string;
  catalogPath?: string;
  regionIdPath?: string;
  errorPath?: string;
  loadingMessage?: string;
};

export type DeclarativeEstimateRecord = {
  currency: string;
  amount: number;
  suffix: string;
  notes?: string[];
  breakdown?: Array<{ label: string; amount: number }>;
  monthlyAverageAmount?: number | null;
  [key: string]: unknown;
};

export type DeclarativeHydrationResult = {
  handled: boolean;
  error?: string;
  nextRegion?: string;
  nextBillingMode?: string;
  nextUsageHours?: string;
  nextInstanceCount?: string;
  values?: Record<string, string>;
};
