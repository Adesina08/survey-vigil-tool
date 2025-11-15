import { getAnalysisTable, type AnalysisTableResponse } from "@/lib/api.analysis";

export type DisplayMode = "counts" | "rowpct" | "colpct" | "totalpct";

export interface AnalysisRequest {
  topBreak: string | null;
  variables: string[];
  mode: DisplayMode;
  limitCategories?: number;
  bins?: number;
  dropMissing?: boolean;
  minCount?: number;
}

export interface AnalysisResult {
  tables: AnalysisTableResponse[];
}

export async function generateAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  const { topBreak, variables, mode, limitCategories, bins, dropMissing, minCount } = request;
  const shouldDropMissing = dropMissing ?? true;

  if (!variables.length) {
    throw new Error("Select at least one variable to analyse.");
  }

  const tables: AnalysisTableResponse[] = [];
  for (const variable of variables) {
    const table = await getAnalysisTable({
      topbreak: topBreak,
      variable,
      stat: mode,
      limitCategories,
      bins,
      dropMissing: shouldDropMissing,
      minCount,
    });
    tables.push(table);
  }

  return { tables };
}
