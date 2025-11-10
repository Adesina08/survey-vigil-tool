import { FilterControls } from "@/components/dashboard/FilterControls";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ProgressCharts } from "@/components/dashboard/ProgressCharts";
import { InteractiveMap } from "@/components/dashboard/InteractiveMap";
import { QuotaTracker } from "@/components/dashboard/QuotaTracker";
import { UserProductivity } from "@/components/dashboard/UserProductivity";
import { ErrorBreakdown } from "@/components/dashboard/ErrorBreakdown";
import { AchievementsTables } from "@/components/dashboard/AchievementsTables";
import type { DashboardData } from "@/lib/dashboardData";

type MapSubmission = DashboardData["mapSubmissions"][number];

interface QualityControlProps {
  dashboardData: DashboardData;
  filteredMapSubmissions: MapSubmission[];
  onFilterChange: (filterType: string, value: string) => void;
  selectedLga: string | null;
}

const QualityControl = ({
  dashboardData,
  filteredMapSubmissions,
  onFilterChange,
  selectedLga,
}: QualityControlProps) => {
  return (
    <div className="space-y-6">
      <FilterControls
        lgas={dashboardData.filters.lgas}
        onFilterChange={onFilterChange}
        selectedLga={selectedLga}
      />

      <SummaryCards data={dashboardData.summary} />

      <ProgressCharts quotaProgress={dashboardData.quotaProgress} statusBreakdown={dashboardData.statusBreakdown} />

      <InteractiveMap
        submissions={filteredMapSubmissions}
        interviewers={dashboardData.filters.interviewers}
        errorTypes={dashboardData.filters.errorTypes}
      />

      <QuotaTracker
        byLGA={dashboardData.quotaByLGA}
        byLGAAge={dashboardData.quotaByLGAAge}
        byLGAGender={dashboardData.quotaByLGAGender}
        lgaCatalog={dashboardData.lgaCatalog}
      />

      <UserProductivity data={dashboardData.userProductivity} />

      <ErrorBreakdown data={dashboardData.errorBreakdown} />

      <AchievementsTables
        byState={dashboardData.achievements.byState}
        byInterviewer={dashboardData.achievements.byInterviewer}
        byLGA={dashboardData.achievements.byLGA}
      />
    </div>
  );
};

export default QualityControl;
