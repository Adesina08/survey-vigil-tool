const viteUrl = typeof import.meta !== "undefined" && import.meta.env?.VITE_APPS_SCRIPT_URL
  ? String(import.meta.env.VITE_APPS_SCRIPT_URL)
  : "";
const nodeUrl = typeof process !== "undefined" && process.env?.APPS_SCRIPT_URL
  ? String(process.env.APPS_SCRIPT_URL)
  : "";
const preferDirectFetch = (() => {
  const value =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_APPS_SCRIPT_DIRECT_FETCH) ??
    (typeof process !== "undefined" ? process.env?.APPS_SCRIPT_DIRECT_FETCH : undefined);
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    return normalised === "1" || normalised === "true" || normalised === "yes";
  }
  return Boolean(value);
})();
const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
const directUrl = (viteUrl || nodeUrl).trim();
const relativeProxyUrl = "/api/apps-script";
const candidateUrls = (() => {
  const urls: string[] = [];
  if (!preferDirectFetch && isBrowser) {
    urls.push(relativeProxyUrl);
  }
  if (directUrl) {
    urls.push(directUrl);
  }
  return urls;
})();
export const API_URL = candidateUrls[0] ?? "";

export interface StructuredAppsScriptPayload {
  rows: Record<string, unknown>[];
  stateTargets?: Record<string, unknown>[];
  stateAgeTargets?: Record<string, unknown>[];
  stateGenderTargets?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  sections?: unknown;
  settings?: Record<string, unknown>;
  mapMetadata?: unknown;
}
export type AppsScriptPayload = StructuredAppsScriptPayload | Record<string, unknown>[];

const isProbablyJson = (contentType: string, raw: string) => {
  if (/application\/json/i.test(contentType)) {
    return true;
  }
  const trimmed = raw.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
};

const normaliseAppsScriptPayload = (value: unknown): AppsScriptPayload => {
  if (Array.isArray(value)) return toRecordArray(value);
  if (!isRecord(value)) throw new Error("Apps Script payload missing rows array.");
  return {
    rows: toRecordArray(value["rows"] ?? value["data"] ?? []),
    stateTargets: toRecordArray(value["stateTargets"]),
    stateAgeTargets: toRecordArray(value["stateAgeTargets"]),
    stateGenderTargets: toRecordArray(value["stateGenderTargets"]),
    metadata: isRecord(value["metadata"]) ? value["metadata"] : undefined,
    sections: value["sections"],
    settings: isRecord(value["settings"]) ? value["settings"] : undefined,
    mapMetadata: value["mapMetadata"],
  } satisfies StructuredAppsScriptPayload;
};

const fetchAndParse = async (url: string): Promise<AppsScriptPayload> => {
  const response = await fetch(url, { method: "GET" });
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();
  if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}: ${raw.slice(0, 200)}`);
  if (!isProbablyJson(contentType, raw)) throw new Error(`Expected JSON but got ${contentType || "unknown"}: ${raw.slice(0, 200)}`);
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normaliseAppsScriptPayload(parsed);
  } catch (error) {
    throw new Error(`Failed to parse Apps Script response: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export async function fetchAppsScript(fields: string = "", rowLimit: number = 1000): Promise<AppsScriptPayload> {
  if (!candidateUrls.length) throw new Error("APPS_SCRIPT_URL is not set");
  const query = fields ? new URLSearchParams({ fields, rowLimit: rowLimit.toString() }) : new URLSearchParams();
  const urls = candidateUrls.map((url) => (url === relativeProxyUrl && query.toString() ? `${url}?${query.toString()}` : url));
  let lastError: unknown;
  for (const url of urls) {
    try {
      return await fetchAndParse(url);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) {
    lastError.message = `${lastError.message} (attempted: ${urls.join(", ")})`;
    throw lastError;
  }
  throw new Error(`Failed to load Apps Script payload: ${String(lastError)} (attempted: ${urls.join(", ")})`);
}
