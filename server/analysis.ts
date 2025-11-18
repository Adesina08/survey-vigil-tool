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
  topbreak?: string | null;
  topbreaks: string[];
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

const PLACEHOLDER_VALUES = new Set([
  "unknown",
  "unknown lga",
  "unknown state",
  "unknown ward",
  "unknown age group",
]);

const isPlaceholderValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  const text = String(value).trim();
  if (!text) {
    return true;
  }
  return PLACEHOLDER_VALUES.has(text.toLowerCase());
};

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
    if (isPlaceholderValue(value)) {
      continue;
    }
    const text = String(value).trim();
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

interface ColumnDefinition {
  id: string;
  topbreak: string;
  category: string;
}

interface BuildCrossTabOptions {
  rows: Record<string, unknown>[];
  topbreaks: string[];
  variable: string;
  stat: "counts" | "rowpct" | "colpct" | "totalpct";
  limitCategories?: number;
}

const buildCrossTab = ({
  rows,
  topbreaks,
  variable,
  stat,
  limitCategories = CATEGORY_LIMIT_DEFAULT,
}: BuildCrossTabOptions): AnalysisTableResponse => {
  const uniqueTopbreaks = Array.from(new Set(topbreaks));
  const variableValues = rows.map((row) => row[variable]);
  const variableCategories = normalizeCategorical(variableValues, limitCategories).map((entry) => entry.value);

  const topbreakCategoryMap: Record<string, string[]> = {};
  for (const topbreak of uniqueTopbreaks) {
    const topValues = rows.map((row) => row[topbreak]);
    topbreakCategoryMap[topbreak] = normalizeCategorical(topValues, limitCategories).map((entry) => entry.value);
  }

  const columns: ColumnDefinition[] = uniqueTopbreaks.flatMap((topbreak) =>
    (topbreakCategoryMap[topbreak] ?? []).map((category) => ({
      id: `${topbreak}:${category}`,
      topbreak,
      category,
    })),
  );

  const counts: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const columnTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const variableCategory of variableCategories) {
    counts[variableCategory] = {};
    rowTotals[variableCategory] = 0;
  }

  for (const row of rows) {
    const rawVariable = row[variable];
    if (isPlaceholderValue(rawVariable)) {
      continue;
    }

    const variableText = String(rawVariable).trim();
    const variableKey = variableCategories.includes(variableText) ? variableText : "Other";

    for (const topbreak of uniqueTopbreaks) {
      const rawTop = row[topbreak];
      if (isPlaceholderValue(rawTop)) {
        continue;
      }

      const topText = String(rawTop).trim();
      const topCategories = topbreakCategoryMap[topbreak] ?? [];
      const topKey = topCategories.includes(topText) ? topText : "Other";
      const columnId = `${topbreak}:${topKey}`;

      counts[variableKey][columnId] = (counts[variableKey][columnId] ?? 0) + 1;
    }
  }

  for (const variableCategory of variableCategories) {
    for (const column of columns) {
      const count = counts[variableCategory]?.[column.id] ?? 0;
      rowTotals[variableCategory] = (rowTotals[variableCategory] ?? 0) + count;
      columnTotals[column.id] = (columnTotals[column.id] ?? 0) + count;
      grandTotal += count;
    }
  }

  const statMatrix: Record<string, Record<string, number>> = {};
  for (const variableCategory of variableCategories) {
    statMatrix[variableCategory] = {};
    for (const column of columns) {
      const count = counts[variableCategory]?.[column.id] ?? 0;
      let value = count;

      if (stat === "rowpct" && rowTotals[variableCategory] > 0) {
        value = (count / rowTotals[variableCategory]) * 100;
      } else if (stat === "colpct" && columnTotals[column.id] > 0) {
        value = (count / columnTotals[column.id]) * 100;
      } else if (stat === "totalpct" && grandTotal > 0) {
        value = (count / grandTotal) * 100;
      }

      statMatrix[variableCategory][column.id] = value;
    }
  }

  let html = '<table class="analysis-table" style="width:100%; border-collapse: collapse;">';
  html += '<thead><tr style="border-bottom: 2px solid #ddd;">';
  html += `<th style="padding: 8px; text-align: left;">${variable}</th>`;
  for (const column of columns) {
    html += `<th style="padding: 8px; text-align: right;">${column.topbreak}: ${column.category}</th>`;
  }
  html += '<th style="padding: 8px; text-align: right;">Total</th>';
  html += "</tr></thead><tbody>";

  for (const variableCategory of variableCategories) {
    html += '<tr style="border-bottom: 1px solid #eee;">';
    html += `<td style="padding: 8px;">${variableCategory}</td>`;
    for (const column of columns) {
      const value = statMatrix[variableCategory]?.[column.id] ?? 0;
      const display = stat === "counts" ? value.toFixed(0) : `${value.toFixed(1)}%`;
      html += `<td style="padding: 8px; text-align: right;">${display}</td>`;
    }
    const totalDisplay = stat === "counts" ? rowTotals[variableCategory] : "100.0%";
    html += `<td style="padding: 8px; text-align: right; font-weight: 600;">${totalDisplay}</td>`;
    html += "</tr>";
  }

  html += "</tbody></table>";

  return {
    html,
    chart: null,
    meta: {
      topbreaks: uniqueTopbreaks,
      topbreak: uniqueTopbreaks[0] ?? null,
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
  topbreaks: string[] | null;
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

  const topbreaks = params.topbreaks;
  const variable = params.variable;

  if (!variable) {
    throw new Error("variable parameter is required");
  }

  if (!topbreaks || topbreaks.length === 0) {
    throw new Error("topbreak parameter is required");
  }

  const stat = (params.stat ?? "rowpct") as "counts" | "rowpct" | "colpct" | "totalpct";
  const limitCategories = params.limitCategories ? Number.parseInt(params.limitCategories, 10) : undefined;

  return buildCrossTab({
    rows,
    topbreaks,
    variable,
    stat,
    limitCategories: Number.isFinite(limitCategories) ? limitCategories : undefined,
  });
};
