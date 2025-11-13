import localforage from "localforage";

export async function readCache<T>(cacheKey: string = "default"): Promise<{ data?: T; when?: string }> {
  try {
    const key = `cache-${cacheKey.replace(/[^a-z0-9]/gi, "_")}`;
    const content = await localforage.getItem(key);
    if (!content) return {};
    const parsed = content as { data: T; when: string };
    if (!parsed.data || !parsed.when) return {};
    return { data: parsed.data, when: parsed.when };
  } catch (error) {
    console.warn("Failed to read cache", error);
    return {};
  }
}

export async function saveCache<T>(data: T, cacheKey: string = "default") {
  try {
    const key = `cache-${cacheKey.replace(/[^a-z0-9]/gi, "_")}`;
    await localforage.setItem(key, { data, when: new Date().toISOString() });
  } catch (error) {
    console.warn("Failed to save cache", error);
  }
}

export function ensureCacheVersion() {
  // Add version checking if needed (e.g., clear old caches)
}
