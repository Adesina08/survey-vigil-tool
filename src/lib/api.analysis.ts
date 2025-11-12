import { ANALYSIS_SCHEMA_ENDPOINT, ANALYSIS_TABLE_ENDPOINT } from "@/lib/api.endpoints";

const DATASET_URL = import.meta.env.VITE_ANALYSIS_DATASET_URL?.trim();

export interface AnalysisField {
  name: string;
  type: "numeric" | "categorical" | string;
  distinct_count: number;
}

export interface AnalysisSchema {
  fields: AnalysisField[];
  topbreak_candidates: string[];
  numeric_candidates: string[];
  categorical_candidates: string[];
}

export interface AnalysisChartPoint {
  x: string | number;
  y: number;
  error?: number | null;
}

export interface AnalysisChartSeries {
  name: string;
  data: AnalysisChartPoint[];
  color?: string;
}

export interface AnalysisHistogramSpec {
  kind: "hist";
  x: string;
  series: AnalysisChartSeries[];
  labels?: {
    x?: string;
    y?: string;
  };
}

export interface AnalysisChartSpec {
  kind: "stacked_bar" | "bar" | "grouped_bar" | "hist";
  x: string;
  series: AnalysisChartSeries[];
  labels?: {
    x?: string;
    y?: string;
  };
  histogram?: AnalysisHistogramSpec;
}

export interface AnalysisMeta {
  topbreak: string | null;
  variable: string;
  n: number;
  stat: string;
  notes?: string[];
}

export interface AnalysisTableResponse {
  html: string;
  chart: AnalysisChartSpec | null;
  meta: AnalysisMeta;
}

interface FetchTableOptions {
  topbreak: string | null;
  variable: string;
  stat?: "counts" | "rowpct" | "colpct" | "totalpct";
  bins?: number;
  limitCategories?: number;
  take?: number;
  dropMissing?: boolean;
  minCount?: number;
  signal?: AbortSignal;
  datasetUrl?: string;
}

const buildQueryString = (options: FetchTableOptions): string => {
  const params = new URLSearchParams();
  if (options.topbreak) {
    params.set("topbreak", options.topbreak);
  }
  params.set("variable", options.variable);
  if (options.stat) {
    params.set("stat", options.stat);
  }
  if (typeof options.bins === "number") {
    params.set("bins", String(options.bins));
  }
  if (typeof options.limitCategories === "number") {
    params.set("limit_categories", String(options.limitCategories));
  }
  if (typeof options.take === "number") {
    params.set("take", String(options.take));
  }
  if (typeof options.minCount === "number") {
    params.set("min_count", String(options.minCount));
  }
  if (typeof options.dropMissing === "boolean") {
    params.set("drop_missing", options.dropMissing ? "true" : "false");
  }
  const datasetUrl = options.datasetUrl?.trim() || DATASET_URL;
  if (datasetUrl) {
    params.set("datasetUrl", datasetUrl);
  }
  return params.toString();
};

export const getAnalysisSchema = async (
  options?: { signal?: AbortSignal; datasetUrl?: string },
): Promise<AnalysisSchema> => {
  const params = new URLSearchParams();
  const datasetUrl = options?.datasetUrl?.trim() || DATASET_URL;
  if (datasetUrl) {
    params.set("datasetUrl", datasetUrl);
  }
  const url = params.size ? `${ANALYSIS_SCHEMA_ENDPOINT}?${params.toString()}` : ANALYSIS_SCHEMA_ENDPOINT;
  const response = await fetch(url, { signal: options?.signal });
  if (!response.ok) {
    throw new Error("Failed to load analysis schema");
  }
  return response.json() as Promise<AnalysisSchema>;
};

export const getAnalysisTable = async (
  options: FetchTableOptions,
): Promise<AnalysisTableResponse> => {
  const query = buildQueryString(options);
  const url = query ? `${ANALYSIS_TABLE_ENDPOINT}?${query}` : ANALYSIS_TABLE_ENDPOINT;
  const response = await fetch(url, {
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to build analysis table");
  }

  return response.json() as Promise<AnalysisTableResponse>;
};
