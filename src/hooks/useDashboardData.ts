import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DashboardData } from "@/lib/dashboardData";
import { ensureCacheVersion } from "@/services/cache";
import { getCachedDashboardData, loadDashboardDataWithCache } from "@/services/loadDashboard";

interface UseDashboardDataOptions {
  onStatusChange?: (status: string) => void;
  sections?: string;
  mapLimit?: number;
  prodLimit?: number;
  analysisLimit?: number;
}

export const useDashboardData = ({
  onStatusChange,
  sections = "summary,quota",
  mapLimit,
  prodLimit,
  analysisLimit,
}: UseDashboardDataOptions = {}) => {
  const [initialData, setInitialData] = useState<Partial<DashboardData> | undefined>(undefined);
  const [initialUpdatedAt, setInitialUpdatedAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    ensureCacheVersion();
    const loadCachedData = async () => {
      const cached = await getCachedDashboardData(sections);
      if (cached.dashboard) {
        setInitialData(cached.dashboard);
      }
      if (cached.cachedAt) {
        const parsed = new Date(cached.cachedAt);
        setInitialUpdatedAt(Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime());
      }
    };
    loadCachedData();
  }, [sections]);

  return useQuery<Partial<DashboardData>, Error>({
    queryKey: ["dashboard-data", sections, { mapLimit, prodLimit, analysisLimit }],
    queryFn: () => loadDashboardDataWithCache(sections, { mapLimit, prodLimit, analysisLimit }, onStatusChange),
    initialData,
    initialDataUpdatedAt: initialUpdatedAt,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
