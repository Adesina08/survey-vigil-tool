export function readCache<T>(cacheKey: string = "default"): { data?: T; when?: string } {
  try {
    const key = `cache-${cacheKey.replace(/[^a-z0-9]/gi, "_")}`;
    const content = localStorage.getItem(key);
    if (!content) return {};
    const parsed = JSON.parse(content);
    if (!parsed.data || !parsed.when) return {};
    return { data: parsed.data as T, when: parsed.when };
  } catch (error) {
    console.warn("Failed to read cache", error);
    return {};
  }
}

export function saveCache<T>(data: T, cacheKey: string = "default") {
  try {
    const key = `cache-${cacheKey.replace(/[^a-z0-9]/gi, "_")}`;
    localStorage.setItem(key, JSON.stringify({ data, when: new Date().toISOString() }));
  } catch (error) {
    console.warn("Failed to save cache", error);
  }
}

export function ensureCacheVersion() {
  // Add version checking if needed (e.g., clear old caches)
}
