import {
  mapSheetRowsToStateAgeTargets,
  mapSheetRowsToStateGenderTargets,
  mapSheetRowsToStateTargets,
  mapSheetRowsToSubmissions,
  normaliseHeaderKey,
  HEADER_ALIASES as BASE_HEADER_ALIASES,
} from "@/lib/googleSheets";
import { buildDashboardData, type DashboardData } from "@/lib/dashboardData";
import { extractMapMetadataFromPayload } from "@/lib/mapMetadata";
import { fetchAppsScript, type AppsScriptPayload } from "./dataSource";
import { readAppsScriptPayload } from "./appsScriptStorage";
import { readCache, saveCache } from "./cache";

const ADDITIONAL_HEADER_ALIASES: Record<string, string> = {
  ward: "Ward",
  wardname: "Ward",
};

const headerAliasLookup: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(ADDITIONAL_HEADER_ALIASES).map(([key, value]) => [normaliseHeaderKey(key), value]),
  ),
  ...BASE_HEADER_ALIASES,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
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
    if (!normalised.State || String(normalised.State).trim().length === 0) normalised.State = "Ogun State";
    if ("Respondent phone number" in normalised) {
      normalised["Respondent phone number"] = ensureString(normalised["Respondent phone number"]);
    }
    return normalised;
  });

export const buildDashboardFromPayload = (payload: AppsScriptPayload): DashboardData => {
  const rawRows = Array.isArray(payload) ? payload : (payload.rows as unknown);
  if (!Array.isArray(rawRows)) throw new Error("Apps Script payload missing rows array.");
  const rows = normaliseRows(applyAliases(toRecordArray(rawRows)));
  const submissions = mapSheetRowsToSubmissions(rows, { defaultState: "Ogun State" });
  const stateTargets = !Array.isArray(payload)
    ? mapSheetRowsToStateTargets(toRecordArray(payload.stateTargets))
    : [];
  const stateAgeTargets = !Array.isArray(payload)
    ? mapSheetRowsToStateAgeTargets(toRecordArray(payload.stateAgeTargets))
    : [];
  const stateGenderTargets = !Array.isArray(payload)
    ? mapSheetRowsToStateGenderTargets(toRecordArray(payload.stateGenderTargets))
    : [];
  const mapMetadata = extractMapMetadataFromPayload(payload);
  return buildDashboardData({
    submissions,
    stateTargets,
    stateAgeTargets,
    stateGenderTargets,
    analysisRows: rows,
    mapMetadata,
  });
};

// New function to fetch sectioned dashboard data
export async function loadDashboardData(
  sections: string,
  _options: { mapLimit?: number; prodLimit?: number; analysisLimit?: number } = {},
): Promise<Partial<DashboardData>> {
  const dashboard = await loadFullDashboardData();
  // saveCache(dashboard, sections);
  return dashboard;
}

export async function loadDashboardDataWithCache(
  sections: string = "summary,quota",
  options: { mapLimit?: number; prodLimit?: number; analysisLimit?: number } = {},
  setStatus?: (status: string) => void,
): Promise<Partial<DashboardData>> {
  const updateStatus = typeof setStatus === "function" ? setStatus : () => {};
  const { data: cached, when } = readCache<Partial<DashboardData>>(sections);
  if (cached && when) {
    const formatted = formatCacheTime(when);
    updateStatus(
      formatted ? `Showing cached data from ${formatted}. Refreshing…` : "Showing cached data. Refreshing…",
    );
  } else if (!cached) {
    updateStatus("Loading…");
  }
  try {
    const dashboard = await loadDashboardData(sections, options);
    const refreshedAt = new Date();
    const formattedRefresh = refreshedAt.toLocaleString();
    updateStatus(`Last refreshed: ${formattedRefresh}`);
    return dashboard;
  } catch (error) {
    if (cached) {
      const formatted = formatCacheTime(when);
      updateStatus(
        formatted
          ? `Offline or server error. Showing cached data from ${formatted}`
          : "Offline or server error. Showing cached data",
      );
      return cached;
    }
    updateStatus("Refresh failed");
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function loadFullDashboardData(): Promise<DashboardData> {
  try {
    const payload = await fetchAppsScript();
    return buildDashboardFromPayload(payload);
  } catch (error) {
    const stored = readAppsScriptPayload();
    if (stored) {
      return buildDashboardFromPayload(stored.payload);
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export const getCachedDashboardData = (sections?: string): { dashboard?: Partial<DashboardData>; cachedAt?: string } => {
  const { data, when } = readCache<Partial<DashboardData>>(sections);
  if (!data) return {};
  return { dashboard: data, cachedAt: when };
};

const formatCacheTime = (iso?: string) => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
};
