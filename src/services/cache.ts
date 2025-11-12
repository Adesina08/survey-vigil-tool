import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_DIR = join(process.cwd(), ".cache");
const CACHE_FILE = (key: string = "default") => join(CACHE_DIR, `cache-${key.replace(/[^a-z0-9]/gi, "_")}.json`);

export function readCache<T>(cacheKey: string = "default"): { data?: T; when?: string } {
  const file = CACHE_FILE(cacheKey);
  if (!existsSync(file)) return {};
  try {
    const content = readFileSync(file, "utf-8");
    const parsed = JSON.parse(content);
    if (!parsed.data || !parsed.when) return {};
    return { data: parsed.data as T, when: parsed.when };
  } catch (error) {
    console.warn("Failed to read cache", error);
    return {};
  }
}

export function saveCache<T>(data: T, cacheKey: string = "default") {
  const file = CACHE_FILE(cacheKey);
  try {
    writeFileSync(file, JSON.stringify({ data, when: new Date().toISOString() }), "utf-8");
  } catch (error) {
    console.warn("Failed to save cache", error);
  }
}

export function ensureCacheVersion() {
  // Add version checking if needed
}
