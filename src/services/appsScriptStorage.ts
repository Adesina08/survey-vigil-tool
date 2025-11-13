import type { AppsScriptPayload } from "./dataSource";

const STORAGE_KEY = "apps-script-payload";

export interface StoredAppsScriptPayload {
  payload: AppsScriptPayload;
  storedAt: string;
}

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function saveAppsScriptPayload(payload: AppsScriptPayload) {
  if (!isBrowser) {
    return;
  }
  try {
    const entry: StoredAppsScriptPayload = {
      payload,
      storedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch (error) {
    console.warn("Failed to persist Apps Script payload", error);
  }
}

export function readAppsScriptPayload(): StoredAppsScriptPayload | undefined {
  if (!isBrowser) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as Partial<StoredAppsScriptPayload>;
    if (!parsed || typeof parsed !== "object" || !parsed.payload) {
      return undefined;
    }
    const storedAt = typeof parsed.storedAt === "string" ? parsed.storedAt : new Date().toISOString();
    return { payload: parsed.payload as AppsScriptPayload, storedAt };
  } catch (error) {
    console.warn("Failed to read Apps Script payload", error);
    return undefined;
  }
}

export function clearAppsScriptPayload() {
  if (!isBrowser) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear Apps Script payload", error);
  }
}
