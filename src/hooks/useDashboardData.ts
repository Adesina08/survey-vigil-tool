import { useEffect, useMemo } from "react";
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
  useEffect(() => {
    ensureCacheVersion();
  }, []);

  const cached = useMemo(() => getCachedDashboardData(sections), [sections]);
  const initialData = cached.dashboard;
  let initialUpdatedAt: number | undefined;
  if (cached.cachedAt) {
    const parsed = new Date(cached.cachedAt);
    initialUpdatedAt = Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime();
  }

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
