import { useCallback, useMemo } from "react";

import { FilterControls } from "@/components/dashboard/FilterControls";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ProgressCharts } from "@/components/dashboard/ProgressCharts";
import { InteractiveMap } from "@/components/map/InteractiveMap";
import { QuotaTracker } from "@/components/quotas/QuotaTracker";
import { UserProductivity } from "@/components/productivity/UserProductivity";
import { ErrorBreakdown } from "@/components/errors/ErrorBreakdown";
import { AchievementsTables } from "@/components/achievements/AchievementsTables";
import { BulkActionDrawer, type CommitPayload } from "@/components/qc/BulkActionDrawer";
import { ExportBar } from "@/components/export/ExportBar";
import type { DashboardData } from "@/lib/dashboardData";
import type { MapSubmission } from "@/types/submission";
import type { QCAnnotated } from "@/lib/qc/engine";
import type { StoredStatus } from "@/components/qc/SingleForceAction";

type MapSubmissionRow = DashboardData["mapSubmissions"][number];

type QualityControlProps = {
  dashboardData: DashboardData;
  filteredMapSubmissions: MapSubmissionRow[];
  onFilterChange: (filterType: string, value: string) => void;
  selectedLga: string | null;
  overrides: Record<string, StoredStatus>;
  onBulkCommit: (payload: CommitPayload) => void;
};

const QualityControl = ({
  dashboardData,
  filteredMapSubmissions,
  onFilterChange,
  selectedLga,
  overrides,
  onBulkCommit,
}: QualityControlProps) => {
  const mapSubmissionsWithOverrides = useMemo(() => {
    return filteredMapSubmissions.map((submission) => {
      const override = overrides[submission.id];
      if (!override) {
        return submission;
      }
      const nextErrors = new Set(submission.errorTypes);
      if (override.status === "not_approved") {
        nextErrors.add("Force Cancelled");
      } else {
        nextErrors.delete("Force Cancelled");
      }
      return { ...submission, status: override.status, errorTypes: Array.from(nextErrors) };
    });
  }, [filteredMapSubmissions, overrides]);

  const qcRows: QCAnnotated[] = useMemo(() => {
    return mapSubmissionsWithOverrides.map((submission) => ({
      ...submission,
      autoFlags: [...submission.errorTypes],
      geotagStatus: undefined,
      actualLGA: undefined,
      clusterWithIds: [],
      proximityDistanceMeters: null,
    }));
  }, [mapSubmissionsWithOverrides]);

  const quotaByState = useMemo(() => {
    const aggregation = new Map<string, { target: number; achieved: number }>();
    dashboardData.quotaByLGA.forEach((row) => {
      const current = aggregation.get(row.state) ?? { target: 0, achieved: 0 };
      current.target += row.target;
      current.achieved += row.achieved;
      aggregation.set(row.state, current);
    });
    return Array.from(aggregation.entries()).map(([state, values]) => ({
      state,
      target: values.target,
      achieved: values.achieved,
    }));
  }, [dashboardData.quotaByLGA]);

  const quotaByAge = useMemo(
    () =>
      dashboardData.quotaByLGAAge.map((row) => ({
        state: row.state,
        ageGroup: row.ageGroup,
        target: row.target,
        achieved: row.achieved,
      })),
    [dashboardData.quotaByLGAAge],
  );

  const quotaByGender = useMemo(
    () =>
      dashboardData.quotaByLGAGender.map((row) => ({
        state: row.state,
        gender: row.gender,
        target: row.target,
        achieved: row.achieved,
      })),
    [dashboardData.quotaByLGAGender],
  );

  const handleStatusPersist = useCallback(
    (id: string, record: StoredStatus) => {
      onBulkCommit({ [id]: record });
    },
    [onBulkCommit],
  );

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
        submissions={mapSubmissionsWithOverrides as MapSubmission[]}
        interviewers={dashboardData.filters.interviewers}
        errorTypes={dashboardData.filters.errorTypes}
        lgaGeo={dashboardData.lgaGeo}
        overrides={overrides}
        onStatusPersist={handleStatusPersist}
      />

      <QuotaTracker states={quotaByState} ages={quotaByAge} genders={quotaByGender} />

      <UserProductivity data={dashboardData.userProductivity} />

      <ErrorBreakdown data={dashboardData.errorBreakdown} />

      <AchievementsTables
        byState={dashboardData.achievements.byState}
        byInterviewer={dashboardData.achievements.byInterviewer}
        byLGA={dashboardData.achievements.byLGA}
      />

      <div className="flex flex-wrap gap-3">
        <BulkActionDrawer rows={qcRows} onCommit={onBulkCommit} />
      </div>

      <ExportBar submissions={mapSubmissionsWithOverrides as MapSubmission[]} />
    </div>
  );
};

export default QualityControl;
