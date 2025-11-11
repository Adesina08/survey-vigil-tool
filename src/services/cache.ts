import { APP_VERSION } from "@/lib/appVersion";

const CACHE_KEY = "appsScript.lastGoodPayload";
const CACHE_TIME_KEY = "appsScript.lastRefreshIso";
const CACHE_VERSION_KEY = "appsScript.appVersion";

const getStorage = (): Storage | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch (error) {
    console.warn("Local storage unavailable", error);
    return undefined;
  }
};

const storage = getStorage();

export function clearCache() {
  if (!storage) {
    return;
  }

  storage.removeItem(CACHE_KEY);
  storage.removeItem(CACHE_TIME_KEY);
  storage.removeItem(CACHE_VERSION_KEY);
}

export function ensureCacheVersion() {
  if (!storage) {
    return;
  }

  const storedVersion = storage.getItem(CACHE_VERSION_KEY);
  if (storedVersion && storedVersion !== APP_VERSION) {
    clearCache();
    try {
      storage.setItem(CACHE_VERSION_KEY, APP_VERSION);
    } catch (error) {
      console.warn("Failed to persist app version", error);
    }
    if (typeof window !== "undefined" && typeof window.location?.reload === "function") {
      window.location.reload();
    }
    return;
  }

  if (!storedVersion) {
    try {
      storage.setItem(CACHE_VERSION_KEY, APP_VERSION);
    } catch (error) {
      console.warn("Failed to persist app version", error);
    }
  }
}

export function saveCache(payload: unknown) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(CACHE_KEY, JSON.stringify(payload));
    storage.setItem(CACHE_TIME_KEY, new Date().toISOString());
    storage.setItem(CACHE_VERSION_KEY, APP_VERSION);
  } catch (error) {
    console.warn("Failed to save Apps Script cache", error);
  }
}

export function readCache<T = unknown>(): { data?: T; when?: string } {
  if (!storage) {
    return {};
  }

  const storedVersion = storage.getItem(CACHE_VERSION_KEY);
  if (storedVersion && storedVersion !== APP_VERSION) {
    clearCache();
    return {};
  }

  const raw = storage.getItem(CACHE_KEY);
  const when = storage.getItem(CACHE_TIME_KEY) ?? undefined;

  if (!raw) {
    return {};
  }

  try {
    return { data: JSON.parse(raw) as T, when };
  } catch (error) {
    console.warn("Failed to read Apps Script cache", error);
    clearCache();
    return {};
  }
}
