import {
  mapSheetRowsToStateAgeTargets,
  mapSheetRowsToStateGenderTargets,
  mapSheetRowsToStateTargets,
  mapSheetRowsToSubmissions,
  normaliseHeaderKey,
  HEADER_ALIASES as BASE_HEADER_ALIASES,
} from "@/lib/googleSheets";
import { buildDashboardData, type DashboardData } from "@/lib/dashboardData";
import { fetchAppsScript, type AppsScriptPayload } from "./dataSource";
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
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
};

const aliasKey = (key: string): string => {
  const normalised = normaliseHeaderKey(key);
  if (!normalised) {
    return key;
  }

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

export const buildDashboardFromPayload = (payload: AppsScriptPayload): DashboardData => {
  const rawRows = Array.isArray(payload) ? payload : (payload.rows as unknown);

  if (!Array.isArray(rawRows)) {
    throw new Error("Apps Script payload missing rows array.");
  }

  const rows = applyAliases(toRecordArray(rawRows));
  const submissions = mapSheetRowsToSubmissions(rows);

  const stateTargets = !Array.isArray(payload)
    ? mapSheetRowsToStateTargets(toRecordArray(payload.stateTargets))
    : [];
  const stateAgeTargets = !Array.isArray(payload)
    ? mapSheetRowsToStateAgeTargets(toRecordArray(payload.stateAgeTargets))
    : [];
  const stateGenderTargets = !Array.isArray(payload)
    ? mapSheetRowsToStateGenderTargets(toRecordArray(payload.stateGenderTargets))
    : [];

  return buildDashboardData({
    submissions,
    stateTargets,
    stateAgeTargets,
    stateGenderTargets,
    analysisRows: rows,
  });
};

export async function loadDashboardData(): Promise<DashboardData> {
  const payload = await fetchAppsScript();
  const dashboard = buildDashboardFromPayload(payload);
  saveCache(payload);
  return dashboard;
}

const formatCacheTime = (iso?: string) => {
  if (!iso) {
    return null;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleString();
};

export async function loadDashboardDataWithCache(
  setStatus?: (status: string) => void,
): Promise<DashboardData> {
  const updateStatus = typeof setStatus === "function" ? setStatus : () => {};
  const { data: cached, when } = readCache<AppsScriptPayload>();

  if (cached && when) {
    const formatted = formatCacheTime(when);
    updateStatus(
      formatted ? `Showing cached data from ${formatted}. Refreshing…` : "Showing cached data. Refreshing…",
    );
  } else if (!cached) {
    updateStatus("Loading…");
  }

  try {
    const dashboard = await loadDashboardData();
    updateStatus(`Last refreshed: ${dashboard.lastUpdated}`);
    return dashboard;
  } catch (error) {
    if (cached) {
      const fallback = buildDashboardFromPayload(cached);
      const formatted = formatCacheTime(when);
      updateStatus(
        formatted
          ? `Offline or server error. Showing cached data from ${formatted}`
          : "Offline or server error. Showing cached data",
      );
      return fallback;
    }

    updateStatus("Refresh failed");
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export const getCachedDashboardData = (): { dashboard?: DashboardData; cachedAt?: string } => {
  const { data, when } = readCache<AppsScriptPayload>();
  if (!data) {
    return {};
  }

  try {
    const dashboard = buildDashboardFromPayload(data);
    return { dashboard, cachedAt: when };
  } catch (error) {
    console.warn("Failed to hydrate dashboard from cache", error);
    return {};
  }
};
