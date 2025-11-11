import {
  sheetSubmissions,
  sheetStateTargets,
  sheetStateAgeTargets,
  sheetStateGenderTargets,
  type SheetSubmissionRow,
  type SheetStateTargetRow,
  type SheetStateAgeTargetRow,
  type SheetStateGenderTargetRow,
  type ErrorType,
} from "@/data/sampleData";
import { applyQualityChecks, type ProcessedSubmissionRow } from "./qualityChecks";
import { normaliseHeaderKey } from "./googleSheets";
import { getSubmissionMetrics, type Row as MetricRow } from "@/utils/metrics";
import { getErrorBreakdown } from "@/utils/errors";

export type AnalysisRow = Record<string, unknown>;

interface MapSubmission {
  id: string;
  lat: number;
  lng: number;
  interviewerId: string;
  interviewerName: string;
  interviewerLabel: string;
  lga: string;
  state: string;
  errorTypes: string[];
  timestamp: string;
  status: "approved" | "not_approved";
}

interface SummaryData {
  overallTarget: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  approvalRate: number;
  notApprovedSubmissions: number;
  notApprovedRate: number;
  latestSubmissionTime?: string | null;
}

interface StatusBreakdown {
  approved: number;
  notApproved: number;
}

interface QuotaLGARow {
  state: string;
  lga: string;
  target: number;
  achieved: number;
  balance: number;
}

interface QuotaLGAAgeRow extends QuotaLGARow {
  ageGroup: string;
}

interface QuotaLGAGenderRow extends QuotaLGARow {
  gender: string;
}

interface ProductivityRow {
  interviewerId: string;
  interviewerName: string;
  displayLabel: string;
  totalSubmissions: number;
  validSubmissions: number;
  invalidSubmissions: number;
  approvalRate: number;
  errors: Record<string, number>;
  totalErrors: number;
}

interface ErrorBreakdownRow {
  errorType: string;
  count: number;
  percentage: number;
}

interface AchievementRow {
  total: number;
  approved: number;
  notApproved: number;
  percentageApproved: number;
}

interface AchievementByStateRow extends AchievementRow {
  state: string;
}

interface AchievementByInterviewerRow extends AchievementRow {
  interviewerId: string;
  interviewerName: string;
  displayLabel: string;
}

interface AchievementByLGARow extends AchievementRow {
  lga: string;
  state: string;
}

export interface DashboardData {
  summary: SummaryData;
  statusBreakdown: StatusBreakdown;
  quotaProgress: number;
  quotaByLGA: QuotaLGARow[];
  quotaByLGAAge: QuotaLGAAgeRow[];
  quotaByLGAGender: QuotaLGAGenderRow[];
  mapSubmissions: MapSubmission[];
  userProductivity: ProductivityRow[];
  errorBreakdown: ErrorBreakdownRow[];
  achievements: {
    byState: AchievementByStateRow[];
    byInterviewer: AchievementByInterviewerRow[];
    byLGA: AchievementByLGARow[];
  };
  filters: {
    lgas: string[];
    interviewers: Array<{
      id: string;
      name: string;
      label: string;
    }>;
    errorTypes: string[];
  };
  lastUpdated: string;
  analysisRows: AnalysisRow[];
}

const parseDate = (date: string, time: string) => new Date(`${date}T${time}:00Z`);

const incrementMap = (map: Map<string, number>, key: string, amount = 1) => {
  map.set(key, (map.get(key) ?? 0) + amount);
};

const getNumber = (value: number | undefined | null) => (value ?? 0);

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const getCoordinate = (row: SheetSubmissionRow, key: "lat" | "lng") => {
  const candidate =
    key === "lat"
      ? row["_A5. GPS Coordinates_latitude"] ?? row.Latitude
      : row["_A5. GPS Coordinates_longitude"] ?? row.Longitude;

  return parseNumeric(candidate) ?? 0;
};

const getSubmissionIndex = (row: SheetSubmissionRow): number | null => {
  const candidate =
    row._index ?? row._id ?? row._uuid ?? (row["Submission ID"] as unknown);

  if (candidate === undefined || candidate === null) {
    return null;
  }

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate === "string" && candidate.trim().length > 0) {
    const parsed = Number.parseInt(candidate, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

const sanitiseText = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const getLGA = (row: SheetSubmissionRow) => {
  const candidates = [
    row["A3. select the LGA"],
    row.LGA,
    (row as Record<string, unknown>)["lga"],
  ];

  for (const candidate of candidates) {
    const cleaned = sanitiseText(candidate);
    if (cleaned) {
      return cleaned;
    }
  }

  return null;
};

const getInterviewerId = (row: SheetSubmissionRow) => {
  const enumeratorId = sanitiseText(row["A1. Enumerator ID"]);
  return enumeratorId ?? "Unknown";
};

const getInterviewerName = (row: SheetSubmissionRow) => {
  const candidates = [
    row["Enumerator Name"],
    row["Interviewer Name"],
    (row as Record<string, unknown>)["interviewer_name"],
    (row as Record<string, unknown>)["enumerator_name"],
    row.interviewer,
    row.username,
  ];

  for (const candidate of candidates) {
    const cleaned = sanitiseText(candidate);
    if (cleaned) {
      return cleaned;
    }
  }

  return getInterviewerId(row);
};

const getApprovalStatus = (row: SheetSubmissionRow) => {
  const status = row["Approval Status"] ?? row["Outcome Status"] ?? "Valid";
  return status === "Approved" || status === "Valid" ? "Approved" : "Not Approved";
};

interface DashboardDataInput {
  submissions: SheetSubmissionRow[];
  stateTargets?: SheetStateTargetRow[];
  stateAgeTargets?: SheetStateAgeTargetRow[];
  stateGenderTargets?: SheetStateGenderTargetRow[];
  analysisRows?: AnalysisRow[];
}

export const buildDashboardData = ({
  submissions,
  stateTargets = [],
  stateAgeTargets = [],
  stateGenderTargets = [],
  analysisRows,
}: DashboardDataInput): DashboardData => {
  const metricsRows: MetricRow[] = Array.isArray(analysisRows)
    ? (analysisRows as MetricRow[])
    : (submissions as unknown as MetricRow[]);
  const requireGpsForApproval = true;
  const metrics = getSubmissionMetrics(metricsRows, requireGpsForApproval);

  const processedSubmissions: ProcessedSubmissionRow[] = applyQualityChecks(submissions);
  const totalSubmissions = metrics.total;

  const approvedByState = new Map<string, number>();
  const approvedByStateAge = new Map<string, number>();
  const approvedByStateGender = new Map<string, number>();
  const totalsByState = new Map<string, number>();
  const notApprovedByState = new Map<string, number>();

  const totalsByInterviewer = new Map<string, number>();
  const approvedByInterviewer = new Map<string, number>();
  const notApprovedByInterviewer = new Map<string, number>();

  const totalsByLGA = new Map<string, number>();
  const approvedByLGA = new Map<string, number>();
  const notApprovedByLGA = new Map<string, number>();

  const totalsByLGAAge = new Map<string, number>();
  const approvedByLGAAge = new Map<string, number>();
  const notApprovedByLGAAge = new Map<string, number>();

  const totalsByLGAGender = new Map<string, number>();
  const approvedByLGAGender = new Map<string, number>();
  const notApprovedByLGAGender = new Map<string, number>();

  const totalsByStateAge = new Map<string, number>();
  const totalsByStateGender = new Map<string, number>();

  const interviewerNames = new Map<string, string>();

  const errorTypes: ErrorType[] = [
    "OddHour",
    "Low LOI",
    "High LOI",
    "Outside LGA Boundary",
    "DuplicatePhone",
    "Interwoven",
    "ShortGap",
    "ClusteredInterview",
    "Terminated",
  ];
  const errorCounts: Record<string, number> = Object.fromEntries(
    errorTypes.map((type) => [type, 0])
  );

  const interviewerErrors = new Map<string, Record<string, number>>();

  const lgaSet = new Set<string>();
  const interviewerSet = new Set<string>();
  const errorTypeSet = new Set<string>();

  const mapSubmissions: Array<MapSubmission & { sortKey: number }> = [];
  let latestTimestamp = new Date(0);

  processedSubmissions.forEach((row) => {
    const state = row.State ?? "Unknown State";
    const ageGroup = row["Age Group"] ?? "Unknown";
    const gender = row.Gender ?? "Unknown";
    const interviewerId = getInterviewerId(row);
    const interviewerName = getInterviewerName(row);
    const interviewerLabel =
      interviewerName && interviewerName !== interviewerId
        ? `${interviewerId} · ${interviewerName}`
        : interviewerId;
    const lga = getLGA(row);
    const approvalStatus = getApprovalStatus(row);
    const errorFlags = row["Error Flags"] ?? [];

    const lat = getCoordinate(row, "lat");
    const lng = getCoordinate(row, "lng");

    const hasValidCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
    const hasValidLGA = typeof lga === "string" && lga.length > 0;

    const timestamp = parseDate(row["Submission Date"], row["Submission Time"]);
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
    }

    if (hasValidLGA) {
      lgaSet.add(lga!);
    }
    if (interviewerId && interviewerId.toLowerCase() !== "unknown") {
      interviewerSet.add(interviewerId);
    }
    errorFlags.forEach((flag) => errorTypeSet.add(flag));

    incrementMap(totalsByState, state);
    incrementMap(totalsByInterviewer, interviewerId);
    if (hasValidLGA) {
      incrementMap(totalsByLGA, `${state}|${lga}`);
      incrementMap(totalsByLGAAge, `${state}|${lga}|${ageGroup}`);
      incrementMap(totalsByLGAGender, `${state}|${lga}|${gender}`);
    }
    incrementMap(totalsByStateAge, `${state}|${ageGroup}`);
    incrementMap(totalsByStateGender, `${state}|${gender}`);

    interviewerNames.set(interviewerId, interviewerName);
    const interviewerError = interviewerErrors.get(interviewerId) ?? {};

    const isApproved =
      approvalStatus === "Approved" && (!requireGpsForApproval || hasValidCoordinates);

    if (isApproved) {
      incrementMap(approvedByState, state);
      incrementMap(approvedByStateAge, `${state}|${ageGroup}`);
      incrementMap(approvedByStateGender, `${state}|${gender}`);
      incrementMap(approvedByInterviewer, interviewerId);
      if (hasValidLGA) {
        incrementMap(approvedByLGA, `${state}|${lga}`);
        incrementMap(approvedByLGAAge, `${state}|${lga}|${ageGroup}`);
        incrementMap(approvedByLGAGender, `${state}|${lga}|${gender}`);
      }
    } else {
      incrementMap(notApprovedByState, state);
      incrementMap(notApprovedByInterviewer, interviewerId);
      if (hasValidLGA) {
        incrementMap(notApprovedByLGA, `${state}|${lga}`);
        incrementMap(notApprovedByLGAAge, `${state}|${lga}|${ageGroup}`);
        incrementMap(notApprovedByLGAGender, `${state}|${lga}|${gender}`);
      }
    }

    errorFlags.forEach((errorType) => {
      errorCounts[errorType] = getNumber(errorCounts[errorType]) + 1;
      interviewerError[errorType] = getNumber(interviewerError[errorType]) + 1;
    });

    interviewerErrors.set(interviewerId, interviewerError);

    const metadata = row.qualityMetadata;

    if (hasValidCoordinates && hasValidLGA) {
      const rowIndex = getSubmissionIndex(row);
      const submissionId =
        sanitiseText(row["Submission ID"]) ??
        (rowIndex !== null ? String(rowIndex) : undefined) ??
        `${state}-${lga}-${timestamp.getTime()}`;

      mapSubmissions.push({
        id: submissionId,
        lat,
        lng,
        interviewerId,
        interviewerName,
        interviewerLabel,
        lga: lga!,
        state,
        errorTypes: errorFlags,
        timestamp: timestamp.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: (metadata?.isValid ?? isApproved) ? "approved" : "not_approved",
        sortKey: timestamp.getTime(),
      });
    }
  });

  const totalApproved = metrics.approved;
  const totalNotApproved = metrics.notApproved;

  const effectiveStateTargets =
    stateTargets.length > 0
      ? stateTargets
      : [...totalsByState.entries()].map(([state, total]) => ({
          State: state,
          "State Target": total,
        }));

  const effectiveStateAgeTargets =
    stateAgeTargets.length > 0
      ? stateAgeTargets
      : [...totalsByStateAge.entries()].map(([key, total]) => {
          const [state, ageGroup] = key.split("|");
          return {
            State: state,
            "Age Group": ageGroup,
            "Age Group Target": total,
          };
        });

  const effectiveStateGenderTargets =
    stateGenderTargets.length > 0
      ? stateGenderTargets
      : [...totalsByStateGender.entries()].map(([key, total]) => {
          const [state, gender] = key.split("|");
          return {
            State: state,
            Gender: gender as SheetStateGenderTargetRow["Gender"],
            "Gender Target": total,
          };
        });

  const overallTarget = effectiveStateTargets.reduce(
    (sum, row) => sum + row["State Target"],
    0
  );

  const approvalRate = totalSubmissions > 0 ? (totalApproved / totalSubmissions) * 100 : 0;
  const notApprovedRate = totalSubmissions > 0 ? (totalNotApproved / totalSubmissions) * 100 : 0;

  const quotaProgress = overallTarget > 0 ? (totalApproved / overallTarget) * 100 : 0;

  const quotaByLGA: QuotaLGARow[] = [...totalsByLGA.entries()]
    .map(([key, total]) => {
      const [state, lga] = key.split("|");
      const achieved = approvedByLGA.get(key) ?? 0;
      const balance = Math.max(total - achieved, 0);
      return {
        state,
        lga,
        target: total,
        achieved,
        balance,
      };
    })
    .sort((a, b) => a.lga.localeCompare(b.lga));

  const quotaByLGAAge: QuotaLGAAgeRow[] = [...totalsByLGAAge.entries()]
    .map(([key, total]) => {
      const [state, lga, ageGroup] = key.split("|");
      const achieved = approvedByLGAAge.get(key) ?? 0;
      const balance = Math.max(total - achieved, 0);
      return {
        state,
        lga,
        ageGroup,
        target: total,
        achieved,
        balance,
      };
    })
    .sort((a, b) => {
      const lgaComparison = a.lga.localeCompare(b.lga);
      if (lgaComparison !== 0) return lgaComparison;
      return a.ageGroup.localeCompare(b.ageGroup);
    });

  const quotaByLGAGender: QuotaLGAGenderRow[] = [...totalsByLGAGender.entries()]
    .map(([key, total]) => {
      const [state, lga, gender] = key.split("|");
      const achieved = approvedByLGAGender.get(key) ?? 0;
      const balance = Math.max(total - achieved, 0);
      return {
        state,
        lga,
        gender: gender as QuotaLGAGenderRow["gender"],
        target: total,
        achieved,
        balance,
      };
    })
    .sort((a, b) => {
      const lgaComparison = a.lga.localeCompare(b.lga);
      if (lgaComparison !== 0) return lgaComparison;
      return a.gender.localeCompare(b.gender);
    });

  const userProductivity: ProductivityRow[] = [...totalsByInterviewer.entries()]
    .map(([interviewerId, total]) => {
      const name = interviewerNames.get(interviewerId) ?? "";
      const label =
        name && name !== interviewerId ? `${interviewerId} · ${name}` : interviewerId;
      const errorStats = interviewerErrors.get(interviewerId) ?? {};
      const approvedCount = approvedByInterviewer.get(interviewerId) ?? 0;
      const invalidCount = notApprovedByInterviewer.get(interviewerId) ?? Math.max(total - approvedCount, 0);
      const approvalRate = total > 0 ? (approvedCount / total) * 100 : 0;
      const totalErrors = Object.values(errorStats).reduce((sum, value) => sum + value, 0);

      return {
        interviewerId,
        interviewerName: name || interviewerId,
        displayLabel: label,
        totalSubmissions: total,
        validSubmissions: approvedCount,
        invalidSubmissions: invalidCount,
        approvalRate,
        errors: errorStats,
        totalErrors,
      };
    })
    .filter((row) => row.interviewerId.toLowerCase() !== "unknown");

  const rowErrorCounts = getErrorBreakdown(metricsRows);
  const finalErrorCounts = Object.keys(rowErrorCounts).length > 0 ? rowErrorCounts : errorCounts;

  Object.keys(finalErrorCounts).forEach((code) => errorTypeSet.add(code));

  const totalErrorEvents = Object.values(finalErrorCounts).reduce((sum, value) => sum + value, 0);
  const errorBreakdown: ErrorBreakdownRow[] = Object.entries(finalErrorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      errorType: label,
      count,
      percentage: totalErrorEvents > 0 ? (count / totalErrorEvents) * 100 : 0,
    }));

  const achievementsByState: AchievementByStateRow[] = [...totalsByState.entries()].map(([state, total]) => {
    const approved = approvedByState.get(state) ?? 0;
    const notApproved = notApprovedByState.get(state) ?? (total - approved);
    const computedTotal = approved + notApproved;

    return {
      state,
      total: computedTotal,
      approved,
      notApproved,
      percentageApproved: computedTotal > 0 ? (approved / computedTotal) * 100 : 0,
    };
  });

  const achievementsByInterviewer: AchievementByInterviewerRow[] = [...totalsByInterviewer.entries()].map(
    ([interviewerId, total]) => {
      const approved = approvedByInterviewer.get(interviewerId) ?? 0;
      const notApproved = notApprovedByInterviewer.get(interviewerId) ?? (total - approved);
      const name = interviewerNames.get(interviewerId) ?? "";
      const label = name && name !== interviewerId ? `${interviewerId} · ${name}` : interviewerId;

      return {
        interviewerId,
        interviewerName: name || interviewerId,
        displayLabel: label,
        total,
        approved,
        notApproved,
        percentageApproved: total > 0 ? (approved / total) * 100 : 0,
      };
    }
  ).filter((row) => row.interviewerId.toLowerCase() !== "unknown");

  const achievementsByLGA: AchievementByLGARow[] = [...totalsByLGA.entries()].map(([key, total]) => {
    const [state, lga] = key.split("|");
    const approved = approvedByLGA.get(key) ?? 0;
    const notApproved = notApprovedByLGA.get(key) ?? (total - approved);
    const computedTotal = approved + notApproved;

    return {
      lga,
      state,
      total: computedTotal,
      approved,
      notApproved,
      percentageApproved: computedTotal > 0 ? (approved / computedTotal) * 100 : 0,
    };
  });

  const summary: SummaryData = {
    overallTarget,
    totalSubmissions,
    approvedSubmissions: totalApproved,
    approvalRate: Number(approvalRate.toFixed(1)),
    notApprovedSubmissions: totalNotApproved,
    notApprovedRate: Number(notApprovedRate.toFixed(1)),
  };

  const statusBreakdown: StatusBreakdown = {
    approved: totalApproved,
    notApproved: totalNotApproved,
  };

  const sortedMapSubmissions = mapSubmissions
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ sortKey, ...entry }) => entry);

  const lastUpdated = totalSubmissions > 0
    ? latestTimestamp.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No data available";

  const normalizedRows: AnalysisRow[] =
    analysisRows ??
    submissions.map((row) => {
      const normalized: AnalysisRow = {};
      Object.entries(row).forEach(([key, value]) => {
        if (typeof key !== "string" || key.length === 0) {
          return;
        }
        const normalizedKey = normaliseHeaderKey(key);
        if (!normalizedKey) {
          return;
        }
        const cleanedValue = Array.isArray(value)
          ? value.join(" | ")
          : value === undefined
            ? null
            : value;
        normalized[normalizedKey] = cleanedValue;
      });
      return normalized;
    });

  return {
    summary,
    statusBreakdown,
    quotaProgress: Number(quotaProgress.toFixed(1)),
    quotaByLGA,
    quotaByLGAAge,
    quotaByLGAGender,
    mapSubmissions: sortedMapSubmissions,
    userProductivity,
    errorBreakdown,
    achievements: {
      byState: achievementsByState,
      byInterviewer: achievementsByInterviewer,
      byLGA: achievementsByLGA,
    },
    filters: {
      lgas: Array.from(lgaSet)
        .filter((value) => value && value.toLowerCase() !== "unknown")
        .sort(),
      interviewers: Array.from(interviewerSet)
        .filter((value) => value && value.toLowerCase() !== "unknown")
        .map((id) => {
          const name = interviewerNames.get(id) ?? "";
          const label = name && name !== id ? `${id} · ${name}` : id;
          return {
            id,
            name: name || id,
            label,
          };
        })
        .sort((a, b) => a.id.localeCompare(b.id)),
      errorTypes: Array.from(errorTypeSet).sort(),
    },
    lastUpdated,
    analysisRows: normalizedRows,
  };
};

export const dashboardData = buildDashboardData({
  submissions: sheetSubmissions,
  stateTargets: sheetStateTargets,
  stateAgeTargets: sheetStateAgeTargets,
  stateGenderTargets: sheetStateGenderTargets,
});
