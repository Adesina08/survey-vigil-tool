import { useMemo } from "react";

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
  const {
    summary,
    quotaProgress,
    statusBreakdown,
    productivity,
    errorBreakdown,
    achievementsByInterviewer,
    achievementsByLGA,
    filteredQuotaByLGA,
    filteredQuotaByLGAAge,
    filteredQuotaByLGAGender,
  } = useMemo(() => {
    const submissions = filteredMapSubmissions;
    const relevantQuotaByLGA = selectedLga
      ? dashboardData.quotaByLGA.filter((row) => row.lga === selectedLga)
      : dashboardData.quotaByLGA;
    const relevantQuotaByLGAAge = selectedLga
      ? dashboardData.quotaByLGAAge.filter((row) => row.lga === selectedLga)
      : dashboardData.quotaByLGAAge;
    const relevantQuotaByLGAGender = selectedLga
      ? dashboardData.quotaByLGAGender.filter((row) => row.lga === selectedLga)
      : dashboardData.quotaByLGAGender;

    const productivityMap = new Map<
      string,
      {
        interviewerId: string;
        interviewerName: string;
        displayLabel: string;
        totalSubmissions: number;
        validSubmissions: number;
        invalidSubmissions: number;
        approvalRate: number;
        errors: Record<string, number>;
        totalErrors: number;
        treatmentPathCount: number;
        controlPathCount: number;
        unknownPathCount: number;
      }
    >();

    const errorTotals = new Map<string, number>();
    const achievementsByLGAMap = new Map<
      string,
      {
        state: string;
        lga: string;
        total: number;
        approved: number;
        notApproved: number;
        treatmentPathCount: number;
        controlPathCount: number;
        unknownPathCount: number;
      }
    >();

    submissions.forEach((submission) => {
      const interviewerId = submission.interviewerId;
      const existing = productivityMap.get(interviewerId) ?? {
        interviewerId,
        interviewerName: submission.interviewerName,
        displayLabel: submission.interviewerLabel,
        totalSubmissions: 0,
        validSubmissions: 0,
        invalidSubmissions: 0,
        approvalRate: 0,
        errors: {},
        totalErrors: 0,
        treatmentPathCount: 0,
        controlPathCount: 0,
        unknownPathCount: 0,
      };

      existing.totalSubmissions += 1;
      if (submission.status === "approved") {
        existing.validSubmissions += 1;
      } else {
        existing.invalidSubmissions += 1;
      }

      switch (submission.ogstepPath) {
        case "treatment":
          existing.treatmentPathCount += 1;
          break;
        case "control":
          existing.controlPathCount += 1;
          break;
        default:
          existing.unknownPathCount += 1;
          break;
      }

      submission.errorTypes.forEach((errorType) => {
        existing.errors[errorType] = (existing.errors[errorType] ?? 0) + 1;
        existing.totalErrors += 1;
        errorTotals.set(errorType, (errorTotals.get(errorType) ?? 0) + 1);
      });

      productivityMap.set(interviewerId, existing);

      const lgaKey = `${submission.state}|${submission.lga}`;
      const lgaEntry = achievementsByLGAMap.get(lgaKey) ?? {
        state: submission.state,
        lga: submission.lga,
        total: 0,
        approved: 0,
        notApproved: 0,
        treatmentPathCount: 0,
        controlPathCount: 0,
        unknownPathCount: 0,
      };
      lgaEntry.total += 1;
      if (submission.status === "approved") {
        lgaEntry.approved += 1;
      } else {
        lgaEntry.notApproved += 1;
      }

      switch (submission.ogstepPath) {
        case "treatment":
          lgaEntry.treatmentPathCount += 1;
          break;
        case "control":
          lgaEntry.controlPathCount += 1;
          break;
        default:
          lgaEntry.unknownPathCount += 1;
          break;
      }
      achievementsByLGAMap.set(lgaKey, lgaEntry);
    });

    const productivity = Array.from(productivityMap.values()).map((row) => ({
      ...row,
      approvalRate: row.totalSubmissions > 0 ? (row.validSubmissions / row.totalSubmissions) * 100 : 0,
    }));

    const achievementsByInterviewer = productivity
      .map((row) => ({
        interviewerId: row.interviewerId,
        interviewerName: row.interviewerName,
        displayLabel: row.displayLabel,
        total: row.totalSubmissions,
        approved: row.validSubmissions,
        notApproved: row.invalidSubmissions,
        percentageApproved: Number(row.approvalRate.toFixed(1)),
        treatmentPathCount: row.treatmentPathCount,
        controlPathCount: row.controlPathCount,
        unknownPathCount: row.unknownPathCount,
      }))
      .sort((a, b) => b.approved - a.approved);

    const achievementsByLGA = Array.from(achievementsByLGAMap.values())
      .map((row) => ({
        ...row,
        percentageApproved: row.total > 0 ? Number(((row.approved / row.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.lga.localeCompare(b.lga));

    const errorTypeList = dashboardData.filters.errorTypes;
    const totalErrors = Array.from(errorTotals.values()).reduce((sum, value) => sum + value, 0);
    const errorBreakdown = (errorTypeList.length > 0 ? errorTypeList : Array.from(errorTotals.keys()))
      .map((errorType) => {
        const count = errorTotals.get(errorType) ?? 0;
        const percentage = totalErrors > 0 ? (count / totalErrors) * 100 : 0;
        return {
          errorType,
          count,
          percentage: Number(percentage.toFixed(1)),
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      summary: {
        overallTarget: dashboardData.summary.overallTarget,
        totalSubmissions: dashboardData.summary.totalSubmissions,
        approvedSubmissions: dashboardData.summary.approvedSubmissions,
        approvalRate: dashboardData.summary.approvalRate,
        notApprovedSubmissions: dashboardData.summary.notApprovedSubmissions,
        notApprovedRate: dashboardData.summary.notApprovedRate,
        completionRate: dashboardData.quotaProgress,
        treatmentPathCount: dashboardData.summary.treatmentPathCount,
        controlPathCount: dashboardData.summary.controlPathCount,
        unknownPathCount: dashboardData.summary.unknownPathCount,
      },
      quotaProgress: dashboardData.quotaProgress,
      statusBreakdown: dashboardData.statusBreakdown,
      productivity,
      errorBreakdown,
      achievementsByInterviewer,
      achievementsByLGA,
      filteredQuotaByLGA: relevantQuotaByLGA,
      filteredQuotaByLGAAge: relevantQuotaByLGAAge,
      filteredQuotaByLGAGender: relevantQuotaByLGAGender,
    };
  }, [
    dashboardData.filters.errorTypes,
    dashboardData.quotaByLGA,
    dashboardData.quotaByLGAAge,
    dashboardData.quotaByLGAGender,
    dashboardData.summary,
    dashboardData.statusBreakdown,
    dashboardData.quotaProgress,
    filteredMapSubmissions,
    selectedLga,
  ]);

  return (
    <div className="space-y-6">
      <FilterControls
        lgas={dashboardData.filters.lgas}
        onFilterChange={onFilterChange}
        selectedLga={selectedLga}
      />

      <SummaryCards data={summary} />

      <ProgressCharts quotaProgress={quotaProgress} statusBreakdown={statusBreakdown} />

      <InteractiveMap
        submissions={filteredMapSubmissions}
        interviewers={dashboardData.filters.interviewers}
        errorTypes={dashboardData.filters.errorTypes}
        lgas={dashboardData.filters.lgas}
      />

      <QuotaTracker
        byLGA={filteredQuotaByLGA}
        byLGAAge={filteredQuotaByLGAAge}
        byLGAGender={filteredQuotaByLGAGender}
      />

      <UserProductivity data={productivity} errorTypes={dashboardData.filters.errorTypes} />

      <ErrorBreakdown data={errorBreakdown} />

      <AchievementsTables
        byState={dashboardData.achievements.byState}
        byInterviewer={achievementsByInterviewer}
        byLGA={achievementsByLGA}
      />
    </div>
  );
};

export default QualityControl;
