import { useMemo } from "react";
import type { DashboardData } from "@/types/dashboard";
import { determineApprovalStatus } from "@/utils/approval";
import { extractErrorCodes, extractQualityIndicatorCounts } from "@/utils/errors";
import { normaliseErrorType } from "@/lib/errorTypes";
import { FilterControls } from "./FilterControls";
import { SummaryCards } from "./SummaryCards";
import { ProgressCharts } from "./ProgressCharts";
import { InteractiveMap } from "./InteractiveMap";
import { QuotaTracker } from "./QuotaTracker";
import { UserProductivity } from "./UserProductivity";
import { ErrorBreakdown } from "./ErrorBreakdown";
import { AchievementsTables } from "./AchievementsTables";

type NormalisedRow = Record<string, unknown>;
type OgstepPath = "treatment" | "control" | "unknown";

// Utility functions
const getFirstTextValue = (row: NormalisedRow, keys: string[]): string | null => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const matchesSelectedLga = (value: unknown, selectedLga: string): boolean => {
  if (typeof value !== "string") return false;
  const normalise = (s: string) => s.trim().toLowerCase();
  const target = normalise(selectedLga);
  const candidates = value
    .split(/[;,/]+/)
    .map((part) => normalise(part))
    .filter((part) => part.length > 0);
  return candidates.includes(target);
};

const normaliseOgstepResponse = (value: string | null): OgstepPath => {
  if (!value) return "unknown";
  const lower = value.trim().toLowerCase();
  if (lower.startsWith("y") || lower === "1" || lower === "yes" || lower === "true") return "treatment";
  if (lower.startsWith("n") || lower === "0" || lower === "no" || lower === "false") return "control";
  return "unknown";
};

const getOgstepPathFromRow = (row: NormalisedRow): OgstepPath => {
  const response =
    getFirstTextValue(row, [
      "B2. Did you participate in OGSTEP?",
      "b2_did_you_participate_in_ogstep",
      "did_you_participate_in_ogstep",
      "ogstep",
      "ogstep_participation",
      "ogstep_response",
    ]) ?? null;
  return normaliseOgstepResponse(response);
};

const getGenderFromRow = (row: NormalisedRow): "male" | "female" | "unknown" => {
  const value =
    getFirstTextValue(row, [
      "A7. Sex",
      "a7_sex",
      "Gender",
      "gender",
      "respondent_gender",
      "respondent sex",
    ]) ?? null;

  if (!value) {
    return "unknown";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("m")) return "male";
  if (normalized.startsWith("f")) return "female";
  return "unknown";
};

interface QualityControlContentProps {
  dashboardData: DashboardData;
  selectedLga: string | null;
  onFilterChange: (filterType: string, value: string) => void;
}

export const QualityControlContent = ({ dashboardData, selectedLga, onFilterChange }: QualityControlContentProps) => {
  // Filter map submissions by selectedLga
  const filteredMapSubmissions = useMemo(() => {
    if (!selectedLga) return dashboardData.mapSubmissions || [];
    return (dashboardData.mapSubmissions || []).filter((submission) =>
      matchesSelectedLga(submission.lga, selectedLga),
    );
  }, [dashboardData.mapSubmissions, selectedLga]);

  // Filter analysis rows by selectedLga
  const filteredAnalysisRows = useMemo(() => {
    const rows = (dashboardData.analysisRows || []) as NormalisedRow[];
    if (!selectedLga) return rows;

    return rows.filter((row) => {
      const lgaValue =
        getFirstTextValue(row, [
          "A3. Select the LGA",
          "a3_select_the_lga",
          "lga",
          "local_government_area",
          "local_government",
          "location_lga",
        ]) ?? "";
      return matchesSelectedLga(lgaValue, selectedLga);
    });
  }, [dashboardData.analysisRows, selectedLga]);

  const {
    summary,
    quotaSummary,
    statusBreakdown,
    productivity,
    errorBreakdown,
    achievementsByInterviewer,
    achievementsByLGA,
    errorTypes,
  } = useMemo(() => {
    const relevantQuotaByLGA = selectedLga
      ? (dashboardData.quotaByLGA || []).filter((row) => matchesSelectedLga(row.lga, selectedLga))
      : dashboardData.quotaByLGA || [];
    const relevantQuotaByLGAAge = selectedLga
      ? (dashboardData.quotaByLGAAge || []).filter((row) => matchesSelectedLga(row.lga, selectedLga))
      : dashboardData.quotaByLGAAge || [];
    const relevantQuotaByLGAGender = selectedLga
      ? (dashboardData.quotaByLGAGender || []).filter((row) => matchesSelectedLga(row.lga, selectedLga))
      : dashboardData.quotaByLGAGender || [];

    const rows = filteredAnalysisRows as NormalisedRow[];
    let totalSubmissions = 0;
    let approvedCount = 0;
    let notApprovedCount = 0;
    let maleCount = 0;
    let femaleCount = 0;

    const pathTotals: Record<OgstepPath, number> = { treatment: 0, control: 0, unknown: 0 };
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

    const achievementsByInterviewerMap = new Map<
      string,
      {
        interviewerId: string;
        interviewerName: string;
        total: number;
        approved: number;
        notApproved: number;
        treatmentPathCount: number;
        controlPathCount: number;
        unknownPathCount: number;
      }
    >();

    const achievementsByLGAMap = new Map<
      string,
      {
        lga: string;
        total: number;
        approved: number;
        notApproved: number;
        treatmentPathCount: number;
        controlPathCount: number;
        unknownPathCount: number;
      }
    >();

    rows.forEach((row) => {
      totalSubmissions += 1;

      const interviewerId =
        getFirstTextValue(row, [
          "interviewer_id",
          "Interviewer ID",
          "INTERVIEWER_ID",
          "a1_interviewer_id",
          "a1. Interviewer ID",
        ]) ?? "Unknown";

      const interviewerName =
        getFirstTextValue(row, ["interviewer_name", "Interviewer Name", "INTERVIEWER_NAME"]) ?? "Unknown";

      const lga =
        getFirstTextValue(row, [
          "A3. Select the LGA",
          "a3_select_the_lga",
          "lga",
          "local_government_area",
          "local_government",
          "location_lga",
        ]) ?? "Unknown";

      const ogstepPath = getOgstepPathFromRow(row);

      const key = `${interviewerId}::${interviewerName}`;

      const genderValue = getGenderFromRow(row);
      if (genderValue === "male") maleCount += 1;
      else if (genderValue === "female") femaleCount += 1;

      if (!productivityMap.has(key)) {
        productivityMap.set(key, {
          interviewerId,
          interviewerName,
          displayLabel: interviewerName === "Unknown" ? interviewerId : `${interviewerName} (${interviewerId})`,
          totalSubmissions: 0,
          validSubmissions: 0,
          invalidSubmissions: 0,
          approvalRate: 0,
          errors: {},
          totalErrors: 0,
          treatmentPathCount: 0,
          controlPathCount: 0,
          unknownPathCount: 0,
        });
      }

      const existing = productivityMap.get(key)!;

      const approvalStatus = determineApprovalStatus(row);
      const isApproved = approvalStatus === "Approved";
      if (isApproved) {
        existing.validSubmissions += 1;
        approvedCount += 1;
      } else {
        existing.invalidSubmissions += 1;
        notApprovedCount += 1;
      }
      existing.totalSubmissions += 1;

      if (ogstepPath === "treatment") existing.treatmentPathCount += 1;
      else if (ogstepPath === "control") existing.controlPathCount += 1;
      else existing.unknownPathCount += 1;

      pathTotals[ogstepPath] += 1;

      const qualityCounts = extractQualityIndicatorCounts(row);
      Object.entries(qualityCounts).forEach(([code, value]) => {
        if (!value || !Number.isFinite(value)) return;
        const info = normaliseErrorType(code);
        existing.errors[info.label] = (existing.errors[info.label] ?? 0) + value;
        existing.totalErrors += value;
        errorTotals.set(info.slug, (errorTotals.get(info.slug) ?? 0) + value);
      });

      extractErrorCodes(row).forEach((code) => {
        const info = normaliseErrorType(code);
        existing.errors[info.label] = (existing.errors[info.label] ?? 0) + 1;
        existing.totalErrors += 1;
        errorTotals.set(info.slug, (errorTotals.get(info.slug) ?? 0) + 1);
      });

      // Achievements by interviewer
      const interviewerKey = `${interviewerId}::${interviewerName}`;
      if (!achievementsByInterviewerMap.has(interviewerKey)) {
        achievementsByInterviewerMap.set(interviewerKey, {
          interviewerId,
          interviewerName,
          total: 0,
          approved: 0,
          notApproved: 0,
          treatmentPathCount: 0,
          controlPathCount: 0,
          unknownPathCount: 0,
        });
      }
      const interviewerEntry = achievementsByInterviewerMap.get(interviewerKey)!;
      interviewerEntry.total += 1;
      if (isApproved) interviewerEntry.approved += 1;
      else interviewerEntry.notApproved += 1;
      if (ogstepPath === "treatment") interviewerEntry.treatmentPathCount += 1;
      else if (ogstepPath === "control") interviewerEntry.controlPathCount += 1;
      else interviewerEntry.unknownPathCount += 1;

      // Achievements by LGA
      const lgaKey = lga;
      if (!achievementsByLGAMap.has(lgaKey)) {
        achievementsByLGAMap.set(lgaKey, {
          lga,
          total: 0,
          approved: 0,
          notApproved: 0,
          treatmentPathCount: 0,
          controlPathCount: 0,
          unknownPathCount: 0,
        });
      }
      const lgaEntry = achievementsByLGAMap.get(lgaKey)!;
      lgaEntry.total += 1;
      if (isApproved) lgaEntry.approved += 1;
      else lgaEntry.notApproved += 1;
      if (ogstepPath === "treatment") lgaEntry.treatmentPathCount += 1;
      else if (ogstepPath === "control") lgaEntry.controlPathCount += 1;
      else lgaEntry.unknownPathCount += 1;
      achievementsByLGAMap.set(lgaKey, lgaEntry);
    });

    const productivity = Array.from(productivityMap.values())
      .map((row) => ({
        ...row,
        approvalRate: row.totalSubmissions > 0 ? (row.validSubmissions / row.totalSubmissions) * 100 : 0,
      }))
      .filter((row) => row.interviewerId.trim().length > 0 && row.interviewerId.toLowerCase() !== "unknown");

    const achievementsByInterviewer = productivity
      .map((row) => ({
        interviewerId: row.interviewerId,
        interviewerName: row.interviewerName,
        total: row.totalSubmissions,
        approved: row.validSubmissions,
        notApproved: row.invalidSubmissions,
        treatmentPathCount: row.treatmentPathCount,
        controlPathCount: row.controlPathCount,
        unknownPathCount: row.unknownPathCount,
        percentageApproved: row.totalSubmissions > 0 ? Number(((row.validSubmissions / row.totalSubmissions) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.approved - a.approved);

    const achievementsByLGA = Array.from(achievementsByLGAMap.values())
      .map((row) => ({
        ...row,
        percentageApproved: row.total > 0 ? Number(((row.approved / row.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.lga.localeCompare(b.lga));

    const totalTarget = selectedLga
      ? relevantQuotaByLGA.reduce((sum, row) => sum + row.target, 0)
      : dashboardData.summary?.overallTarget || 0;

    const approvedAgainstTarget = selectedLga
      ? relevantQuotaByLGA.reduce((sum, row) => sum + row.achieved, 0)
      : approvedCount;

    const completionRate =
      totalTarget > 0 ? Number(((approvedAgainstTarget / totalTarget) * 100).toFixed(1)) : 0;

    const submissionsAgainstTarget = totalSubmissions;
    const submissionProgressPercent =
      totalTarget > 0 ? Number(((submissionsAgainstTarget / totalTarget) * 100).toFixed(1)) : 0;

    const quotaSummary = {
      achieved: submissionsAgainstTarget,
      remaining: Math.max(totalTarget - submissionsAgainstTarget, 0),
      target: totalTarget,
      achievedPercent: submissionProgressPercent,
    };

    const approvalRatePercent =
      totalSubmissions > 0 ? Number(((approvedCount / totalSubmissions) * 100).toFixed(1)) : 0;

    const notApprovedRatePercent =
      totalSubmissions > 0 ? Number(((notApprovedCount / totalSubmissions) * 100).toFixed(1)) : 0;

    const summary = {
      overallTarget: totalTarget,
      totalSubmissions,
      approvedSubmissions: approvedCount,
      approvalRate: approvalRatePercent,
      notApprovedSubmissions: notApprovedCount,
      notApprovedRate: notApprovedRatePercent,
      completionRate,
      treatmentPathCount: pathTotals.treatment,
      controlPathCount: pathTotals.control,
      unknownPathCount: pathTotals.unknown,
      maleCount,
      femaleCount,
    };

    const totalErrors = Array.from(errorTotals.values()).reduce((sum, value) => sum + value, 0);

    const errorBreakdown = Array.from(errorTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([slug, count]) => {
        const info = normaliseErrorType(slug);
        return {
          code: info.slug,
          errorType: info.label,
          relatedVariables: info.relatedVariables,
          count,
          percentage: totalErrors > 0 ? Number(((count / totalErrors) * 100).toFixed(1)) : 0,
        };
      });

    return {
      summary,
      quotaSummary,
      statusBreakdown: { approved: approvedCount, notApproved: notApprovedCount },
      productivity,
      errorBreakdown,
      achievementsByInterviewer,
      achievementsByLGA,
      errorTypes: errorBreakdown.map((item) => item.errorType),
    };
  }, [
    dashboardData.quotaByLGA,
    dashboardData.quotaByLGAAge,
    dashboardData.quotaByLGAGender,
    dashboardData.summary,
    filteredAnalysisRows,
    selectedLga,
  ]);

  return (
    <div className="space-y-8">
      <FilterControls
        selectedLga={selectedLga}
        lgas={dashboardData.lgas || []}
        onFilterChange={onFilterChange}
      />
      <SummaryCards summary={summary} />
      <div className="space-y-6">
        <ProgressCharts quotaSummary={quotaSummary} statusBreakdown={statusBreakdown} />
        <QuotaTracker />
      </div>
      <InteractiveMap
        submissions={filteredMapSubmissions}
        interviewers={dashboardData.filters?.interviewers || []}
        errorTypes={dashboardData.filters?.errorTypes || []}
        metadata={dashboardData.mapMetadata}
      />
      <UserProductivity
        data={productivity}
        errorTypes={errorTypes.length > 0 ? errorTypes : dashboardData.filters?.errorTypes || []}
      />
      <ErrorBreakdown data={errorBreakdown} />
      <AchievementsTables
        byState={dashboardData.achievements?.byState || []}
        byInterviewer={achievementsByInterviewer}
        byLGA={achievementsByLGA}
      />
    </div>
  );
};
