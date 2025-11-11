import { loadDashboardData } from "./dashboard";

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

export interface AnalysisChartSpec {
  kind: "stacked_bar" | "bar" | "grouped_bar" | "hist";
  x: string;
  series: AnalysisChartSeries[];
  labels?: {
    x?: string;
    y?: string;
  };
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

const CURATED_TOP_BREAKS = [
  "a3_select_the_lga",
  "a3b_select_the_ward",
  "a7_sex",
  "a8_age",
  "c4_current_employment_status",
  "d2_type_of_enterprise",
  "e2_business_sector",
  "g3_member_of_mens_womens_or_youth_group",
  "h1_satisfaction_with_ogstep",
  "h2_trust_in_implementing_institutions",
];

const SAMPLE_SIZE_LIMIT = 1000;
const CATEGORY_LIMIT_DEFAULT = 12;

const inferFields = (rows: Record<string, unknown>[]): AnalysisField[] => {
  if (rows.length === 0) {
    return [];
  }

  const sample = rows.slice(0, Math.min(rows.length, SAMPLE_SIZE_LIMIT));
  const columns = Object.keys(sample[0] ?? {});

  return columns
    .map<AnalysisField | null>((column) => {
      const values = sample
        .map((row) => row[column])
        .filter((value) => value !== null && value !== undefined && value !== "");

      if (values.length === 0) {
        return null;
      }

      const distinctValues = new Set(values.map((value) => `${value}`.trim()).filter(Boolean));
      const distinctCount = distinctValues.size;

      let numericCount = 0;
      for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value)) {
          numericCount++;
        } else if (typeof value === "string") {
          const parsed = Number.parseFloat(value);
          if (Number.isFinite(parsed)) {
            numericCount++;
          }
        }
      }

      const numericRatio = numericCount / values.length;
      const type: AnalysisField["type"] = numericRatio >= 0.8 ? "numeric" : "categorical";

      return {
        name: column,
        type,
        distinct_count: distinctCount,
      };
    })
    .filter((field): field is AnalysisField => field !== null);
};

const normalizeCategorical = (
  values: unknown[],
  limit: number = CATEGORY_LIMIT_DEFAULT,
): { value: string; count: number }[] => {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    const text = String(value).trim();
    if (!text) {
      continue;
    }
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));

  if (sorted.length <= limit) {
    return sorted;
  }

  const top = sorted.slice(0, Math.max(1, limit - 1));
  const otherCount = sorted.slice(Math.max(1, limit - 1)).reduce((sum, item) => sum + item.count, 0);
  return [...top, { value: "Other", count: otherCount }];
};

interface BuildCrossTabOptions {
  rows: Record<string, unknown>[];
  topbreak: string;
  variable: string;
  stat: "counts" | "rowpct" | "colpct" | "totalpct";
  limitCategories?: number;
}

const buildCrossTab = ({
  rows,
  topbreak,
  variable,
  stat,
  limitCategories = CATEGORY_LIMIT_DEFAULT,
}: BuildCrossTabOptions): AnalysisTableResponse => {
  const topValues = rows.map((row) => row[topbreak]);
  const variableValues = rows.map((row) => row[variable]);

  const topCategories = normalizeCategorical(topValues, limitCategories).map((entry) => entry.value);
  const variableCategories = normalizeCategorical(variableValues, limitCategories).map((entry) => entry.value);

  const crosstab: Record<string, Record<string, number>> = {};
  for (const topCategory of topCategories) {
    crosstab[topCategory] = {};
    for (const variableCategory of variableCategories) {
      crosstab[topCategory][variableCategory] = 0;
    }
  }

  for (const row of rows) {
    const rawTop = row[topbreak];
    const rawVariable = row[variable];

    if (rawTop === null || rawTop === undefined || rawVariable === null || rawVariable === undefined) {
      continue;
    }

    const topText = String(rawTop).trim();
    const variableText = String(rawVariable).trim();

    if (!topText || !variableText) {
      continue;
    }

    const topKey = topCategories.includes(topText) ? topText : "Other";
    const variableKey = variableCategories.includes(variableText) ? variableText : "Other";

    if (!crosstab[topKey]) {
      crosstab[topKey] = {};
    }

    if (crosstab[topKey][variableKey] === undefined) {
      crosstab[topKey][variableKey] = 0;
    }

    crosstab[topKey][variableKey] += 1;
  }

  const rowTotals: Record<string, number> = {};
  const columnTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const topCategory of topCategories) {
    rowTotals[topCategory] = 0;
    for (const variableCategory of variableCategories) {
      const count = crosstab[topCategory]?.[variableCategory] ?? 0;
      rowTotals[topCategory] += count;
      columnTotals[variableCategory] = (columnTotals[variableCategory] ?? 0) + count;
      grandTotal += count;
    }
  }

  const statMatrix: Record<string, Record<string, number>> = {};
  for (const topCategory of topCategories) {
    statMatrix[topCategory] = {};
    for (const variableCategory of variableCategories) {
      const count = crosstab[topCategory]?.[variableCategory] ?? 0;
      let value = count;

      if (stat === "rowpct" && rowTotals[topCategory] > 0) {
        value = (count / rowTotals[topCategory]) * 100;
      } else if (stat === "colpct" && columnTotals[variableCategory] > 0) {
        value = (count / columnTotals[variableCategory]) * 100;
      } else if (stat === "totalpct" && grandTotal > 0) {
        value = (count / grandTotal) * 100;
      }

      statMatrix[topCategory][variableCategory] = value;
    }
  }

  let html = '<table class="analysis-table" style="width:100%; border-collapse: collapse;">';
  html += '<thead><tr style="border-bottom: 2px solid #ddd;">';
  html += `<th style="padding: 8px; text-align: left;">${topbreak}</th>`;
  for (const variableCategory of variableCategories) {
    html += `<th style="padding: 8px; text-align: right;">${variableCategory}</th>`;
  }
  html += '<th style="padding: 8px; text-align: right;">Total</th>';
  html += "</tr></thead><tbody>";

  for (const topCategory of topCategories) {
    html += '<tr style="border-bottom: 1px solid #eee;">';
    html += `<td style="padding: 8px;">${topCategory}</td>`;
    for (const variableCategory of variableCategories) {
      const value = statMatrix[topCategory]?.[variableCategory] ?? 0;
      const display = stat === "counts" ? value.toFixed(0) : `${value.toFixed(1)}%`;
      html += `<td style="padding: 8px; text-align: right;">${display}</td>`;
    }
    const totalDisplay = stat === "counts" ? rowTotals[topCategory] : "100.0%";
    html += `<td style="padding: 8px; text-align: right; font-weight: 600;">${totalDisplay}</td>`;
    html += "</tr>";
  }

  html += "</tbody></table>";

  const series: AnalysisChartSeries[] = variableCategories.map((variableCategory) => ({
    name: variableCategory,
    data: topCategories.map((topCategory) => ({
      x: topCategory,
      y: statMatrix[topCategory]?.[variableCategory] ?? 0,
    })),
  }));

  const chart: AnalysisChartSpec = {
    kind: "stacked_bar",
    x: topbreak,
    series,
    labels: {
      x: topbreak,
      y: stat === "counts" ? "Count" : "Percent",
    },
  };

  return {
    html,
    chart,
    meta: {
      topbreak,
      variable,
      n: grandTotal,
      stat,
      notes: [],
    },
  };
};

export const generateAnalysisSchema = async (): Promise<AnalysisSchema> => {
  const dashboardData = await loadDashboardData();
  const rows = dashboardData.analysisRows ?? [];

  const fields = inferFields(rows);
  const availableFieldNames = new Set(fields.map((field) => field.name));

  const categoricalCandidates = fields
    .filter((field) => field.type === "categorical" && field.distinct_count <= 30)
    .map((field) => field.name);

  const numericCandidates = fields
    .filter((field) => field.type === "numeric")
    .map((field) => field.name);

  const curated = CURATED_TOP_BREAKS.filter((key) => availableFieldNames.has(key));
  const autoSet = new Set(categoricalCandidates);
  const extra = Array.from(autoSet).filter((key) => !curated.includes(key)).sort();

  const topbreakCandidates = [...curated, ...extra];

  return {
    fields,
    topbreak_candidates: topbreakCandidates,
    numeric_candidates: numericCandidates,
    categorical_candidates: categoricalCandidates,
  };
};

interface GenerateAnalysisTableOptions {
  topbreak: string | null;
  variable: string | null;
  stat?: string | null;
  limitCategories?: string | null;
}

export const generateAnalysisTable = async (
  params: GenerateAnalysisTableOptions,
): Promise<AnalysisTableResponse> => {
  const dashboardData = await loadDashboardData();
  const rows = dashboardData.analysisRows ?? [];

  if (rows.length === 0) {
    throw new Error("No data available");
  }

  const topbreak = params.topbreak;
  const variable = params.variable;

  if (!variable) {
    throw new Error("variable parameter is required");
  }

  if (!topbreak) {
    throw new Error("topbreak parameter is required");
  }

  const stat = (params.stat ?? "rowpct") as "counts" | "rowpct" | "colpct" | "totalpct";
  const limitCategories = params.limitCategories ? Number.parseInt(params.limitCategories, 10) : undefined;

  return buildCrossTab({
    rows,
    topbreak,
    variable,
    stat,
    limitCategories: Number.isFinite(limitCategories) ? limitCategories : undefined,
  });
};
