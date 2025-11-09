import { useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FilterControls } from "@/components/dashboard/FilterControls";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ProgressCharts } from "@/components/dashboard/ProgressCharts";
import { QuotaTracker } from "@/components/dashboard/QuotaTracker";
import { InteractiveMap } from "@/components/dashboard/InteractiveMap";
import { UserProductivity } from "@/components/dashboard/UserProductivity";
import { ErrorBreakdown } from "@/components/dashboard/ErrorBreakdown";
import { AchievementsTables } from "@/components/dashboard/AchievementsTables";
import { ExportBar } from "@/components/dashboard/ExportBar";
import { dashboardData } from "@/lib/dashboardData";

const Index = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(dashboardData.lastUpdated);
  const [selectedLga, setSelectedLga] = useState<string>("all");

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshed(
        new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }, 2000);
  };

  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === "lga") {
      setSelectedLga(value);
    }
    console.log(`Filter changed: ${filterType} = ${value}`);
  };

  const filteredMapSubmissions = useMemo(() => {
    if (selectedLga === "all") {
      return dashboardData.mapSubmissions;
    }
    return dashboardData.mapSubmissions.filter((submission) => submission.lga === selectedLga);
  }, [selectedLga]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        lastRefreshed={lastRefreshed}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <FilterControls lgas={dashboardData.filters.lgas} onFilterChange={handleFilterChange} />

        <SummaryCards data={dashboardData.summary} />

        <ProgressCharts
          quotaProgress={dashboardData.quotaProgress}
          statusBreakdown={dashboardData.statusBreakdown}
        />

        <InteractiveMap
          submissions={filteredMapSubmissions}
          interviewers={dashboardData.filters.interviewers}
          errorTypes={dashboardData.filters.errorTypes}
        />

        <QuotaTracker
          byState={dashboardData.quotaByState}
          byStateAge={dashboardData.quotaByStateAge}
          byStateGender={dashboardData.quotaByStateGender}
        />

        <UserProductivity data={dashboardData.userProductivity} />

        <ErrorBreakdown data={dashboardData.errorBreakdown} />

        <AchievementsTables
          byState={dashboardData.achievements.byState}
          byInterviewer={dashboardData.achievements.byInterviewer}
          byLGA={dashboardData.achievements.byLGA}
        />
      </main>

      <ExportBar />
    </div>
  );
};

export default Index;
