import { useQuery } from "@tanstack/react-query";

import { dashboardData as sampleDashboardData, type DashboardData } from "@/lib/dashboardData";

const DASHBOARD_ENDPOINT = "/api/dashboard";

export const useDashboardData = () => {
  return useQuery<DashboardData, Error>({
    queryKey: ["dashboard-data"],
    queryFn: async () => {
      const response = await fetch(DASHBOARD_ENDPOINT);

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
      }

      const payload = (await response.json()) as unknown;

      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid dashboard data received from the server.");
      }

      return payload as DashboardData;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    initialData: sampleDashboardData,
  });
};
