const viteUrl = typeof import.meta !== "undefined" && import.meta.env?.VITE_APPS_SCRIPT_URL
  ? String(import.meta.env.VITE_APPS_SCRIPT_URL)
  : "";

const nodeUrl = typeof process !== "undefined" && process.env?.APPS_SCRIPT_URL
  ? String(process.env.APPS_SCRIPT_URL)
  : "";

export const API_URL = viteUrl.trim() || nodeUrl.trim();

export type AppsScriptPayload =
  | {
      rows: Record<string, unknown>[];
      stateTargets?: Record<string, unknown>[];
      stateAgeTargets?: Record<string, unknown>[];
      stateGenderTargets?: Record<string, unknown>[];
    }
  | Record<string, unknown>[];

const isProbablyJson = (contentType: string, raw: string) => {
  if (/application\/json/i.test(contentType)) {
    return true;
  }

  const trimmed = raw.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
};

export async function fetchAppsScript(): Promise<AppsScriptPayload> {
  if (!API_URL) {
    throw new Error("APPS_SCRIPT_URL is not set");
  }

  const response = await fetch(API_URL, { method: "GET" });
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`Apps Script HTTP ${response.status}: ${raw.slice(0, 200)}`);
  }

  if (!isProbablyJson(contentType, raw)) {
    throw new Error(`Expected JSON but got ${contentType || "unknown"}: ${raw.slice(0, 200)}`);
  }

  try {
    return JSON.parse(raw) as AppsScriptPayload;
  } catch (error) {
    throw new Error(`Failed to parse Apps Script response: ${error instanceof Error ? error.message : String(error)}`);
  }
}
