// src/hooks/useDashboardData.ts
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "@/services/dataSource";
import type { DashboardData } from "@/types/dashboard";

export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard-data"],
    queryFn: () => fetchDashboardData(),
    refetchInterval: 30_000, // Poll every 30 seconds for realtime updates
    staleTime: 0, // Always consider data stale to enable refetching
  });
}
