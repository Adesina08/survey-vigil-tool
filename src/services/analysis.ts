import type { Dispatch, SetStateAction } from "react";

export type DisplayMode = "count" | "rowPercent" | "columnPercent" | "totalPercent";

export interface AnalysisRequest {
  topBreaks: string[];
  sideBreaks: string[];
  mode: DisplayMode;
  paths: string[];
}

export interface StyledTable {
  sideBreak: string;
  title: string;
  html: string;
  mode: DisplayMode;
}

export interface ChartDataset {
  label: string;
  backgroundColor: string;
  data: number[];
}

export interface ChartPayload {
  sideBreak: string;
  labels: string[];
  datasets: ChartDataset[];
}

export interface AnalysisResponse {
  tables: StyledTable[];
  chart?: ChartPayload;
  insights: string[];
  metadata: {
    rowCount: number;
    appliedFilters: string[];
  };
}

const API_BASE_URL = import.meta.env.VITE_ANALYSIS_API ?? "http://localhost:8000";
const DATASET_URL = import.meta.env.VITE_ANALYSIS_DATASET_URL?.trim();

export async function generateAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  const payload = {
    ...request,
    ...(DATASET_URL ? { datasetUrl: DATASET_URL } : {}),
  };
  const response = await fetch(`${API_BASE_URL}/generate_table`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Unable to generate analysis table");
  }

  const analysisResponse = (await response.json()) as AnalysisResponse;
  return analysisResponse;
}

export function toggleSelection(
  value: string,
  selected: string[],
  setSelected: Dispatch<SetStateAction<string[]>>,
  allowEmpty = false
) {
  setSelected((prev) => {
    const exists = prev.includes(value);
    const next = exists ? prev.filter((item) => item !== value) : [...prev, value];
    if (!allowEmpty && next.length === 0) {
      return prev;
    }
    return next;
  });
}
