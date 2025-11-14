// src/hooks/useDashboardData.ts
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "@/services/dataSource";
import type { DashboardData } from "@/lib/dashboardData";

export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard-data"],
    queryFn: () => fetchDashboardData(),
    refetchInterval: 30_000,
  });
}
