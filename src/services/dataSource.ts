import {
  HEADER_ALIASES as BASE_HEADER_ALIASES,
  mapSheetRowsToSubmissions,
  normaliseHeaderKey,
} from "@/lib/googleSheets";
import { buildDashboardData, type AnalysisRow, type DashboardData } from "@/lib/dashboardData";
import { fetchAllSurveyRows } from "./googleSheets";

const DEFAULT_STATE = "Ogun State";

const ADDITIONAL_HEADER_ALIASES: Record<string, string> = {
  ward: "Ward",
  wardname: "Ward",
};

const headerAliasLookup: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(ADDITIONAL_HEADER_ALIASES).map(([key, value]) => [normaliseHeaderKey(key), value])
  ),
  ...BASE_HEADER_ALIASES,
};

const aliasKey = (key: string): string => {
  const normalised = normaliseHeaderKey(key);
  if (!normalised) return key;
  const canonical = headerAliasLookup[normalised];
  return canonical ?? key;
};

const applyAliases = (rows: Record<string, unknown>[]) =>
  rows.map((row) => {
    const output: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      const canonicalKey = aliasKey(key);
      output[canonicalKey] = value;
    });
    return output;
  });

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const cleaned = value.replace(/[₦,]/g, "");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normaliseConsent = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return undefined;
  if (text.startsWith("y") || text === "approved" || text === "true") return "Yes";
  if (text.startsWith("n")) return "No";
  return undefined;
};

const normaliseSex = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return undefined;
  if (text.startsWith("m")) return "Male";
  if (text.startsWith("f")) return "Female";
  return undefined;
};

const ensureString = (value: unknown) => {
  if (value === undefined || value === null) return value;
  return String(value);
};

const deriveInterviewDuration = (row: Record<string, unknown>) => {
  const existing = parseNumeric(row["Interview Duration (minutes)"] ?? row["Interview Length (mins)"]);
  if (typeof existing === "number") return existing;
  const start = row.start ?? row.starttime;
  const end = row.end ?? row.endtime;
  if (typeof start !== "string" || typeof end !== "string") return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) return null;
  return Math.round((endDate.getTime() - startDate.getTime()) / 60000);
};

const normaliseRows = (rows: Record<string, unknown>[]) =>
  rows.map((row) => {
    const normalised: Record<string, unknown> = { ...row };
    const consent = normaliseConsent(normalised["A6. Consent to participate"]);
    if (consent) normalised["A6. Consent to participate"] = consent;
    const sex = normaliseSex(normalised["A7. Sex"]);
    if (sex) normalised["A7. Sex"] = sex;
    const numericKeys = [
      "A8. Age",
      "latitude",
      "longitude",
      "Latitude",
      "Longitude",
      "_A5. GPS Coordinates_latitude",
      "_A5. GPS Coordinates_longitude",
      "C5. Monthly income (₦)",
      "E5.1. Monthly revenue",
      "E5.2. Monthly cost",
    ];
    numericKeys.forEach((key) => {
      if (!(key in normalised)) return;
      const parsed = parseNumeric(normalised[key]);
      normalised[key] = parsed ?? null;
    });
    const derivedDuration = deriveInterviewDuration(normalised);
    if (typeof derivedDuration === "number") normalised["Interview Duration (minutes)"] = derivedDuration;
    if (!normalised.State || String(normalised.State).trim().length === 0) normalised.State = DEFAULT_STATE;
    if ("Respondent phone number" in normalised) {
      normalised["Respondent phone number"] = ensureString(normalised["Respondent phone number"]);
    }
    return normalised;
  });

const prepareRows = (rawRows: Record<string, unknown>[]): Record<string, unknown>[] =>
  normaliseRows(applyAliases(rawRows));

export async function fetchDashboardData(): Promise<DashboardData> {
  const rawRows = await fetchAllSurveyRows();
  const preparedRows = prepareRows(rawRows);
  const submissions = mapSheetRowsToSubmissions(preparedRows, { defaultState: DEFAULT_STATE });

  return buildDashboardData({
    submissions,
    analysisRows: preparedRows as AnalysisRow[],
  });
}

