import { loadDashboardData } from "../../server/dashboard";

interface AnalysisField {
  name: string;
  type: "numeric" | "categorical";
  distinct_count: number;
}

interface AnalysisSchema {
  fields: AnalysisField[];
  topbreak_candidates: string[];
  numeric_candidates: string[];
  categorical_candidates: string[];
}

interface AnalysisChartPoint {
  x: string | number;
  y: number;
  error?: number | null;
}

interface AnalysisChartSeries {
  name: string;
  data: AnalysisChartPoint[];
}

interface AnalysisChartSpec {
  kind: "stacked_bar" | "bar" | "grouped_bar";
  x: string;
  series: AnalysisChartSeries[];
  labels?: {
    x?: string;
    y?: string;
  };
}

interface AnalysisMeta {
  topbreak: string | null;
  variable: string;
  n: number;
  stat: string;
  notes?: string[];
}

interface AnalysisTableResponse {
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

const jsonResponse = (statusCode: number, payload: unknown) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const inferFields = (rows: Record<string, unknown>[]): AnalysisField[] => {
  if (rows.length === 0) {
    return [];
  }

  const fields: AnalysisField[] = [];
  const sampleSize = Math.min(rows.length, 1000);
  const sample = rows.slice(0, sampleSize);

  const columns = Object.keys(sample[0] || {});

  for (const column of columns) {
    const values = sample
      .map((row) => row[column])
      .filter((value) => value !== null && value !== undefined && value !== "");

    if (values.length === 0) {
      continue;
    }

    const distinctValues = new Set(values);
    const distinctCount = distinctValues.size;

    // Check if numeric
    let numericCount = 0;
    for (const value of values) {
      if (typeof value === "number") {
        numericCount++;
      } else if (typeof value === "string") {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          numericCount++;
        }
      }
    }

    const numericRatio = numericCount / values.length;
    const type = numericRatio >= 0.8 ? "numeric" : "categorical";

    fields.push({
      name: column,
      type,
      distinct_count: distinctCount,
    });
  }

  return fields;
};

const generateSchema = async (): Promise<AnalysisSchema> => {
  const dashboardData = await loadDashboardData();
  const rows = dashboardData.analysisRows || [];

  const fields = inferFields(rows);
  const availableFieldNames = new Set(fields.map((f) => f.name));

  const categoricalCandidates = fields
    .filter((f) => f.type === "categorical" && f.distinct_count <= 30)
    .map((f) => f.name);

  const numericCandidates = fields
    .filter((f) => f.type === "numeric")
    .map((f) => f.name);

  const curated = CURATED_TOP_BREAKS.filter((key) => availableFieldNames.has(key));
  const autoSet = new Set(categoricalCandidates);
  const extra = Array.from(autoSet).filter((key) => !curated.includes(key));
  extra.sort();

  const topbreakCandidates = [...curated, ...extra];

  return {
    fields,
    topbreak_candidates: topbreakCandidates,
    numeric_candidates: numericCandidates,
    categorical_candidates: categoricalCandidates,
  };
};

const normalizeCategorical = (
  values: unknown[],
  limit: number = 12
): { value: string; count: number }[] => {
  const counts = new Map<string, number>();

  for (const val of values) {
    if (val === null || val === undefined || val === "") continue;
    const str = String(val).trim();
    if (!str) continue;
    counts.set(str, (counts.get(str) || 0) + 1);
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));

  if (sorted.length <= limit) {
    return sorted;
  }

  const top = sorted.slice(0, limit - 1);
  const otherCount = sorted.slice(limit - 1).reduce((sum, item) => sum + item.count, 0);
  return [...top, { value: "Other", count: otherCount }];
};

const buildCrossTab = (
  rows: Record<string, unknown>[],
  topbreak: string,
  variable: string,
  stat: "counts" | "rowpct" | "colpct" | "totalpct",
  limit: number = 12
): AnalysisTableResponse => {
  const topValues = rows.map((r) => r[topbreak]);
  const varValues = rows.map((r) => r[variable]);

  const topCategories = normalizeCategorical(topValues, limit).map((c) => c.value);
  const varCategories = normalizeCategorical(varValues, limit).map((c) => c.value);

  const crosstab: Record<string, Record<string, number>> = {};
  for (const top of topCategories) {
    crosstab[top] = {};
    for (const varCat of varCategories) {
      crosstab[top][varCat] = 0;
    }
  }

  for (const row of rows) {
    const topVal = String(row[topbreak] || "").trim();
    const varVal = String(row[variable] || "").trim();
    if (!topVal || !varVal) continue;

    const topKey = topCategories.includes(topVal) ? topVal : "Other";
    const varKey = varCategories.includes(varVal) ? varVal : "Other";

    if (crosstab[topKey] && crosstab[topKey][varKey] !== undefined) {
      crosstab[topKey][varKey]++;
    }
  }

  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const top of topCategories) {
    rowTotals[top] = 0;
    for (const varCat of varCategories) {
      const count = crosstab[top][varCat];
      rowTotals[top] += count;
      colTotals[varCat] = (colTotals[varCat] || 0) + count;
      grandTotal += count;
    }
  }

  const statMatrix: Record<string, Record<string, number>> = {};
  for (const top of topCategories) {
    statMatrix[top] = {};
    for (const varCat of varCategories) {
      const count = crosstab[top][varCat];
      let value = count;

      if (stat === "rowpct" && rowTotals[top] > 0) {
        value = (count / rowTotals[top]) * 100;
      } else if (stat === "colpct" && colTotals[varCat] > 0) {
        value = (count / colTotals[varCat]) * 100;
      } else if (stat === "totalpct" && grandTotal > 0) {
        value = (count / grandTotal) * 100;
      }

      statMatrix[top][varCat] = value;
    }
  }

  let htmlRows = '<table class="analysis-table" style="width:100%; border-collapse: collapse;">';
  htmlRows += '<thead><tr style="border-bottom: 2px solid #ddd;">';
  htmlRows += `<th style="padding: 8px; text-align: left;">${topbreak}</th>`;
  for (const varCat of varCategories) {
    htmlRows += `<th style="padding: 8px; text-align: right;">${varCat}</th>`;
  }
  htmlRows += '<th style="padding: 8px; text-align: right;">Total</th>';
  htmlRows += "</tr></thead><tbody>";

  for (const top of topCategories) {
    htmlRows += '<tr style="border-bottom: 1px solid #eee;">';
    htmlRows += `<td style="padding: 8px;">${top}</td>`;
    for (const varCat of varCategories) {
      const value = statMatrix[top][varCat];
      const display = stat === "counts" ? value.toFixed(0) : `${value.toFixed(1)}%`;
      htmlRows += `<td style="padding: 8px; text-align: right;">${display}</td>`;
    }
    const totalDisplay = stat === "counts" ? rowTotals[top] : "100.0%";
    htmlRows += `<td style="padding: 8px; text-align: right; font-weight: 600;">${totalDisplay}</td>`;
    htmlRows += "</tr>";
  }
  htmlRows += "</tbody></table>";

  const series: AnalysisChartSeries[] = varCategories.map((varCat) => ({
    name: varCat,
    data: topCategories.map((top) => ({
      x: top,
      y: statMatrix[top][varCat],
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
    html: htmlRows,
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

const generateTable = async (params: Record<string, string>): Promise<AnalysisTableResponse> => {
  const dashboardData = await loadDashboardData();
  const rows = dashboardData.analysisRows || [];

  if (rows.length === 0) {
    throw new Error("No data available");
  }

  const topbreak = params.topbreak || null;
  const variable = params.variable;
  const stat = (params.stat || "rowpct") as "counts" | "rowpct" | "colpct" | "totalpct";

  if (!variable) {
    throw new Error("variable parameter is required");
  }

  if (!topbreak) {
    throw new Error("topbreak parameter is required");
  }

  const limit = parseInt(params.limit_categories || "12", 10);

  return buildCrossTab(rows, topbreak, variable, stat, limit);
};

export const handler = async (event: { path?: string; queryStringParameters?: Record<string, string> }) => {
  try {
    const path = event.path || "";

    if (path.endsWith("/schema")) {
      const schema = await generateSchema();
      return jsonResponse(200, schema);
    }

    if (path.endsWith("/table")) {
      const params = event.queryStringParameters || {};
      const table = await generateTable(params);
      return jsonResponse(200, table);
    }

    return jsonResponse(404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Analysis function error:", error);
    return jsonResponse(500, { error: message });
  }
};
