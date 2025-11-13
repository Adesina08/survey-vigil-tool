import localforage from "localforage";
import type { AppsScriptPayload } from "./dataSource";

const STORAGE_KEY = "apps-script-payload";

export interface StoredAppsScriptPayload {
  payload: AppsScriptPayload;
  storedAt: string;
}

export async function saveAppsScriptPayload(payload: AppsScriptPayload) {
  try {
    const entry: StoredAppsScriptPayload = {
      payload,
      storedAt: new Date().toISOString(),
    };
    await localforage.setItem(STORAGE_KEY, entry);
  } catch (error) {
    console.warn("Failed to persist Apps Script payload", error);
  }
}

export async function readAppsScriptPayload(): Promise<StoredAppsScriptPayload | undefined> {
  try {
    const raw = await localforage.getItem(STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const parsed = raw as Partial<StoredAppsScriptPayload>;
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

export async function clearAppsScriptPayload() {
  try {
    await localforage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear Apps Script payload", error);
  }
}
