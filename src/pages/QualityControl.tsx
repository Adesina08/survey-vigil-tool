import { useMemo } from "react";

import { FilterControls } from "@/components/dashboard/FilterControls";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ProgressCharts } from "@/components/dashboard/ProgressCharts";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { QuotaTracker } from "@/components/dashboard/QuotaTracker";
import { UserProductivity } from "@/components/dashboard/UserProductivity";
import { ErrorBreakdown } from "@/components/dashboard/ErrorBreakdown";
import { AchievementsTables } from "@/components/dashboard/AchievementsTables";
import { BulkActionDrawer } from "@/components/qc/BulkActionDrawer";
import { ExportBar } from "@/components/export/ExportBar";
import { useQcOverrides } from "@/hooks/useQcOverrides";
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
  const { overrides, setOverride } = useQcOverrides();
  const errorTypes = dashboardData.filters.errorTypes;

  const mapSubmissionsWithOverrides = useMemo(() => {
    return filteredMapSubmissions.map((submission) => {
      const override = overrides[submission.id];
      if (!override) return submission;
      const errors = new Set(submission.errorTypes);
      if (override.status === "not_approved") {
        errors.add("Force Cancelled");
      } else if (errors.has("Force Cancelled")) {
        errors.delete("Force Cancelled");
      }
      return { ...submission, status: override.status, errorTypes: Array.from(errors) };
    });
  }, [filteredMapSubmissions, overrides]);

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
        submissions={mapSubmissionsWithOverrides}
        interviewers={dashboardData.filters.interviewers}
        errorTypes={errorTypes}
        overrides={overrides}
        onSetOverride={setOverride}
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

      <BulkActionDrawer
        submissions={mapSubmissionsWithOverrides}
        errorTypes={errorTypes}
        overrides={overrides}
        onSetOverride={setOverride}
      />

      <ExportBar submissions={mapSubmissionsWithOverrides} />
    </div>
  );
};

export default QualityControl;
