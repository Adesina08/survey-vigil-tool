import { useState } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { DashboardData } from "@/lib/dashboardData";
import { QualityControlContent } from "@/components/dashboard/QualityControlContent";

interface QualityControlProps {
  onFilterChange: (filterType: string, value: string) => void;
  selectedLga: string | null;
}

const QualityControl = ({ onFilterChange, selectedLga }: QualityControlProps) => {
  // Fetch sections in groups to keep responses small
  const summaryQuotaQuery = useDashboardData({ sections: "summary,quota", analysisLimit: 1000 });
  const mapQuery = useDashboardData({ sections: "map", mapLimit: 2000 });
  const productivityAnalysisQuery = useDashboardData({
    sections: "productivity,analysis",
    prodLimit: 1000,
    analysisLimit: 1000,
  });
  const errorsQuery = useDashboardData({ sections: "errors" });
  const achievementsQuery = useDashboardData({ sections: "achievements" });
  const filtersQuery = useDashboardData({ sections: "filters" });

  // Handle loading and error states
  const isLoading = [
    summaryQuotaQuery,
    mapQuery,
    productivityAnalysisQuery,
    errorsQuery,
    achievementsQuery,
    filtersQuery,
  ].some((q) => q.isLoading);
  const error = [
    summaryQuotaQuery,
    mapQuery,
    productivityAnalysisQuery,
    errorsQuery,
    achievementsQuery,
    filtersQuery,
  ].find((q) => q.error)?.error;

  // Combine data from queries
  const dashboardData: Partial<DashboardData> = {
    summary: summaryQuotaQuery.data?.summary,
    quotaProgress: summaryQuotaQuery.data?.quotaProgress,
    quotaByLGA: summaryQuotaQuery.data?.quotaByLGA,
    quotaByLGAAge: summaryQuotaQuery.data?.quotaByLGAAge,
    quotaByLGAGender: summaryQuotaQuery.data?.quotaByLGAGender,
    mapSubmissions: mapQuery.data?.mapSubmissions,
    mapMetadata: mapQuery.data?.mapMetadata,
    userProductivity: productivityAnalysisQuery.data?.userProductivity,
    userProductivityDetailed: productivityAnalysisQuery.data?.userProductivityDetailed,
    analysisRows: productivityAnalysisQuery.data?.analysisRows,
    errorBreakdown: errorsQuery.data?.errorBreakdown,
    achievements: achievementsQuery.data?.achievements,
    filters: filtersQuery.data?.filters,
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <QualityControlContent
      dashboardData={dashboardData}
      selectedLga={selectedLga}
      onFilterChange={onFilterChange}
    />
  );
};

export default QualityControl;
