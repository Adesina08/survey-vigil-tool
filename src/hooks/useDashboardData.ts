import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { DashboardData } from "@/lib/dashboardData";
import { ensureCacheVersion } from "@/services/cache";
import {
  getCachedDashboardData,
  loadDashboardDataWithCache,
} from "@/services/loadDashboard";

interface UseDashboardDataOptions {
  onStatusChange?: (status: string) => void;
}

export const useDashboardData = (
  options: UseDashboardDataOptions = {},
) => {
  const { onStatusChange } = options;

  useEffect(() => {
    ensureCacheVersion();
  }, []);

  const cached = useMemo(() => getCachedDashboardData(), []);
  const initialData = cached.dashboard;
  let initialUpdatedAt: number | undefined;
  if (cached.cachedAt) {
    const parsed = new Date(cached.cachedAt);
    initialUpdatedAt = Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime();
  }

  return useQuery<DashboardData, Error>({
    queryKey: ["dashboard-data"],
    queryFn: () => loadDashboardDataWithCache(onStatusChange),
    initialData,
    initialDataUpdatedAt: initialUpdatedAt,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
