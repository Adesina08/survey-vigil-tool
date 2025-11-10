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

export const handler = async (event: { path?: string }) => {
  try {
    const path = event.path || "";

    if (path.endsWith("/schema")) {
      const schema = await generateSchema();
      return jsonResponse(200, schema);
    }

    return jsonResponse(404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Analysis function error:", error);
    return jsonResponse(500, { error: message });
  }
};
