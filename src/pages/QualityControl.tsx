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
import { determineApprovalStatus } from "@/utils/approval";
import { extractErrorCodes, extractQualityIndicatorCounts } from "@/utils/errors";

type NormalisedRow = Record<string, unknown>;

type OgstepPath = "treatment" | "control" | "unknown";

const getFirstTextValue = (row: NormalisedRow, keys: string[]): string | null => {
  for (const key of keys) {
    if (!(key in row)) {
      continue;
    }
    const value = row[key];
    if (value === null || value === undefined) {
      continue;
    }
    const text = String(value).trim();
    if (text) {
      return text;
    }
  }
  return null;
};

const normaliseKey = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();

const matchesSelectedLga = (candidate: string | null, selected: string | null) => {
  if (!candidate || !selected) {
    return false;
  }

  return candidate.trim().toLowerCase() === selected.trim().toLowerCase();
};

const lgaKeyTokens = new Set(
  [
    "lga",
    "a3selectthelga",
    "a3selectthelocalgovernment",
    "lganame",
    "lgaofinterview",
    "localgovernment",
  ].map((key) => key.toLowerCase()),
);

const getInterviewerIdFromRow = (row: NormalisedRow): string =>
  getFirstTextValue(row, [
    "a1_enumerator_id",
    "interviewer_id",
    "enumerator_id",
    "username",
    "interviewer",
    "enumeratorid",
    "interviewerid",
  ]) ?? "Unknown";

const getInterviewerNameFromRow = (row: NormalisedRow, fallbackId: string): string =>
  getFirstTextValue(row, [
    "interviewer_name",
    "enumerator_name",
    "username",
    "interviewer",
  ]) ?? fallbackId;

const getLgaFromRow = (row: NormalisedRow): string | null =>
  getFirstTextValue(row, [
    "lga",
    "LGA",
    "a3_select_the_lga",
    "A3_select_the_LGA",
    "A3. select the LGA",
    "A3. Select The LGA",
    "a3. select the lga",
    "lga_name",
    "LGA_name",
    "lga_of_interview",
    "LGA_of_interview",
    "local_government",
    "Local Government",
  ]) ??
  (() => {
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) {
        continue;
      }

      const normalisedKey = normaliseKey(key);
      if (!lgaKeyTokens.has(normalisedKey)) {
        continue;
      }

      const text = String(value).trim();
      if (text) {
        return text;
      }
    }

    return null;
  })();

const getStateFromRow = (row: NormalisedRow): string =>
  getFirstTextValue(row, [
    "state",
    "State",
    "state_name",
    "State_name",
    "a2_state",
    "A2_state",
    "A2. select the state",
    "A2. Select The State",
  ]) ?? "Unknown State";

const normaliseOgstepResponse = (value: string | null): OgstepPath => {
  if (!value) {
    return "unknown";
  }

  const lower = value.trim().toLowerCase();
  if (!lower) {
    return "unknown";
  }

  if (lower.startsWith("y") || lower === "1" || lower === "yes" || lower === "true") {
    return "treatment";
  }

  if (lower.startsWith("n") || lower === "0" || lower === "no" || lower === "false") {
    return "control";
  }

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
  const filteredAnalysisRows = useMemo(() => {
    const rows = dashboardData.analysisRows ?? [];
    if (!selectedLga) {
      return rows;
    }

    return rows.filter((row) => {
      const lga = getLgaFromRow(row as NormalisedRow);
      return matchesSelectedLga(lga, selectedLga);
    });
  }, [dashboardData.analysisRows, selectedLga]);

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
    errorTypes,
  } = useMemo(() => {
    const relevantQuotaByLGA = selectedLga
      ? dashboardData.quotaByLGA.filter((row) => matchesSelectedLga(row.lga, selectedLga))
      : dashboardData.quotaByLGA;
    const relevantQuotaByLGAAge = selectedLga
      ? dashboardData.quotaByLGAAge.filter((row) => matchesSelectedLga(row.lga, selectedLga))
      : dashboardData.quotaByLGAAge;
    const relevantQuotaByLGAGender = selectedLga
      ? dashboardData.quotaByLGAGender.filter((row) => matchesSelectedLga(row.lga, selectedLga))
      : dashboardData.quotaByLGAGender;

    const rows = filteredAnalysisRows as NormalisedRow[];
    let totalSubmissions = 0;
    let approvedCount = 0;
    let notApprovedCount = 0;

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

    const errorTotals = new Map<string, number>();

    rows.forEach((row) => {
      totalSubmissions += 1;
      const interviewerId = getInterviewerIdFromRow(row);
      const interviewerName = getInterviewerNameFromRow(row, interviewerId);
      const displayLabel =
        interviewerName && interviewerName !== interviewerId
          ? `${interviewerId} · ${interviewerName}`
          : interviewerId;

      const existing = productivityMap.get(interviewerId) ?? {
        interviewerId,
        interviewerName,
        displayLabel,
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

      const ogstepPath = getOgstepPathFromRow(row);
      if (ogstepPath === "treatment") {
        existing.treatmentPathCount += 1;
      } else if (ogstepPath === "control") {
        existing.controlPathCount += 1;
      } else {
        existing.unknownPathCount += 1;
      }
      pathTotals[ogstepPath] += 1;

      const qualityCounts = extractQualityIndicatorCounts(row);
      Object.entries(qualityCounts).forEach(([code, value]) => {
        if (!value || !Number.isFinite(value)) {
          return;
        }
        existing.errors[code] = (existing.errors[code] ?? 0) + value;
        existing.totalErrors += value;
        errorTotals.set(code, (errorTotals.get(code) ?? 0) + value);
      });

      extractErrorCodes(row)
        .filter((code) => !/^QC_(FLAG|WARN)_/i.test(code))
        .forEach((code) => {
          existing.errors[code] = (existing.errors[code] ?? 0) + 1;
          existing.totalErrors += 1;
          errorTotals.set(code, (errorTotals.get(code) ?? 0) + 1);
        });

      productivityMap.set(interviewerId, existing);

      const lga = getLgaFromRow(row);
      if (lga) {
        const state = getStateFromRow(row);
        const trimmedLga = lga.trim();
        const trimmedState = state.trim();
        const key = `${trimmedState.toLowerCase()}|${trimmedLga.toLowerCase()}`;
        const lgaEntry = achievementsByLGAMap.get(key) ?? {
          state: trimmedState,
          lga: trimmedLga,
          total: 0,
          approved: 0,
          notApproved: 0,
          treatmentPathCount: 0,
          controlPathCount: 0,
          unknownPathCount: 0,
        };
        lgaEntry.total += 1;
        if (isApproved) {
          lgaEntry.approved += 1;
        } else {
          lgaEntry.notApproved += 1;
        }
        if (ogstepPath === "treatment") {
          lgaEntry.treatmentPathCount += 1;
        } else if (ogstepPath === "control") {
          lgaEntry.controlPathCount += 1;
        } else {
          lgaEntry.unknownPathCount += 1;
        }
        achievementsByLGAMap.set(key, lgaEntry);
      }
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

    const totalTarget = selectedLga
      ? relevantQuotaByLGA.reduce((sum, row) => sum + row.target, 0)
      : dashboardData.summary.overallTarget;
    const approvedAgainstTarget = selectedLga
      ? relevantQuotaByLGA.reduce((sum, row) => sum + row.achieved, 0)
      : approvedCount;

    const quotaProgress = totalTarget > 0 ? Number(((approvedAgainstTarget / totalTarget) * 100).toFixed(1)) : 0;

    const summary = {
      overallTarget: totalTarget,
      totalSubmissions,
      approvedSubmissions: approvedCount,
      approvalRate: totalSubmissions > 0 ? Number(((approvedCount / totalSubmissions) * 100).toFixed(1)) : 0,
      notApprovedSubmissions: notApprovedCount,
      notApprovedRate: totalSubmissions > 0 ? Number(((notApprovedCount / totalSubmissions) * 100).toFixed(1)) : 0,
      completionRate: quotaProgress,
      treatmentPathCount: pathTotals.treatment,
      controlPathCount: pathTotals.control,
      unknownPathCount: pathTotals.unknown,
    };

    const totalErrors = Array.from(errorTotals.values()).reduce((sum, value) => sum + value, 0);
    const errorBreakdown = Array.from(errorTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([errorType, count]) => ({
        errorType,
        count,
        percentage: totalErrors > 0 ? Number(((count / totalErrors) * 100).toFixed(1)) : 0,
      }));

    return {
      summary,
      quotaProgress,
      statusBreakdown: { approved: approvedCount, notApproved: notApprovedCount },
      productivity,
      errorBreakdown,
      achievementsByInterviewer,
      achievementsByLGA,
      filteredQuotaByLGA: relevantQuotaByLGA,
      filteredQuotaByLGAAge: relevantQuotaByLGAAge,
      filteredQuotaByLGAGender: relevantQuotaByLGAGender,
      errorTypes: errorBreakdown.map((item) => item.errorType),
    };
  }, [
    dashboardData.quotaByLGA,
    dashboardData.quotaByLGAAge,
    dashboardData.quotaByLGAGender,
    dashboardData.summary.overallTarget,
    filteredAnalysisRows,
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
        metadata={dashboardData.mapMetadata}
      />

      <QuotaTracker
        byLGA={filteredQuotaByLGA}
        byLGAAge={filteredQuotaByLGAAge}
        byLGAGender={filteredQuotaByLGAGender}
      />

      <UserProductivity
        data={productivity}
        errorTypes={errorTypes.length > 0 ? errorTypes : dashboardData.filters.errorTypes}
      />

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
