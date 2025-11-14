import type { DashboardData } from "@/types/dashboard";
import { fetchDashboardData } from "./dataSource";

interface LoadOptions {
  mapLimit?: number;
  prodLimit?: number;
  analysisLimit?: number;
}

export async function loadDashboardData(
  _sections: string,
  _options: LoadOptions = {}
): Promise<Partial<DashboardData>> {
  return fetchDashboardData();
}

export async function loadDashboardDataWithCache(
  _sections: string = "summary,quota",
  _options: LoadOptions = {},
  setStatus?: (status: string) => void
): Promise<Partial<DashboardData>> {
  if (setStatus) {
    setStatus("Loading…");
  }

  try {
    const data = await fetchDashboardData();
    if (setStatus) {
      setStatus(`Last refreshed: ${new Date().toLocaleString()}`);
    }
    return data;
  } catch (error) {
    if (setStatus) {
      setStatus("Refresh failed");
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function loadFullDashboardData(): Promise<DashboardData> {
  return fetchDashboardData();
}

export async function getCachedDashboardData(
  _sections?: string
): Promise<{ dashboard?: Partial<DashboardData>; cachedAt?: string }> {
  return {};
}
