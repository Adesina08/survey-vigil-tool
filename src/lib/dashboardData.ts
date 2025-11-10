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

export type AnalysisRow = Record<string, unknown>;

interface MapSubmission {
  id: string;
  lat: number;
  lng: number;
  interviewer: string;
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
  interviewer: string;
  totalSubmissions: number;
  validSubmissions: number;
  invalidSubmissions: number;
  oddHour: number;
  lowLOI: number;
  outsideLGA: number;
  duplicate: number;
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
  interviewer: string;
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
    interviewers: string[];
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
  const candidates = [
    row["A1. Enumerator ID"],
    row["Interviewer ID"],
    (row as Record<string, unknown>)["Enumerator ID"],
    (row as Record<string, unknown>)["enumerator_id"],
    row.username,
    row.interviewer,
    row._submitted_by,
  ];

  for (const candidate of candidates) {
    const cleaned = sanitiseText(candidate);
    if (cleaned) {
      return cleaned;
    }
  }

  return "Unknown";
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
  const processedSubmissions: ProcessedSubmissionRow[] = applyQualityChecks(submissions);

  const submissionIndices = processedSubmissions
    .map((row) => getSubmissionIndex(row))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  const totalSubmissions =
    submissionIndices.length > 0
      ? Math.max(...submissionIndices)
      : processedSubmissions.length;

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
  const errorCounts = Object.fromEntries(
    errorTypes.map((type) => [type, 0])
  ) as Record<ErrorType, number>;

  const interviewerErrors = new Map<
    string,
    {
      oddHour: number;
      lowLOI: number;
      outsideLGA: number;
      duplicate: number;
    }
  >();

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
    const interviewerLabel = `${interviewerId} · ${interviewerName}`;
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
    if (interviewerLabel !== "Unknown · Unknown") {
      interviewerSet.add(interviewerLabel);
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
    const interviewerError = interviewerErrors.get(interviewerId) ?? {
      oddHour: 0,
      lowLOI: 0,
      outsideLGA: 0,
      duplicate: 0,
    };

    const isApproved = approvalStatus === "Approved";

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
      switch (errorType) {
        case "OddHour":
          interviewerError.oddHour += 1;
          break;
        case "Low LOI":
          interviewerError.lowLOI += 1;
          break;
        case "Outside LGA Boundary":
          interviewerError.outsideLGA += 1;
          break;
        case "DuplicatePhone":
          interviewerError.duplicate += 1;
          break;
        default:
          break;
      }
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
        interviewer: interviewerLabel,
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

  const totalApproved = [...approvedByState.values()].reduce((sum, value) => sum + value, 0);
  const totalNotApproved = Math.max(totalSubmissions - totalApproved, 0);

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
      const name = interviewerNames.get(interviewerId) ?? interviewerId;
      const errorStats = interviewerErrors.get(interviewerId) ?? {
        oddHour: 0,
        lowLOI: 0,
        outsideLGA: 0,
        duplicate: 0,
      };
      const approvedCount = approvedByInterviewer.get(interviewerId) ?? 0;
      const invalidCount = notApprovedByInterviewer.get(interviewerId) ?? Math.max(total - approvedCount, 0);

      return {
        interviewer: `${interviewerId} · ${name}`,
        totalSubmissions: total,
        validSubmissions: approvedCount,
        invalidSubmissions: invalidCount,
        oddHour: errorStats.oddHour,
        lowLOI: errorStats.lowLOI,
        outsideLGA: errorStats.outsideLGA,
        duplicate: errorStats.duplicate,
        totalErrors:
          errorStats.oddHour +
          errorStats.lowLOI +
          errorStats.outsideLGA +
          errorStats.duplicate,
      };
    })
    .filter((row) => !row.interviewer.toLowerCase().includes("unknown"));

  const totalErrorEvents = Object.entries(errorCounts).reduce((sum, [, value]) => sum + value, 0);
  const errorBreakdown: ErrorBreakdownRow[] = Object.entries(errorCounts).map(([label, count]) => ({
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
      const interviewerLabel = `${interviewerId} · ${interviewerNames.get(interviewerId) ?? interviewerId}`;

      return {
        interviewer: interviewerLabel,
        total,
        approved,
        notApproved,
        percentageApproved: total > 0 ? (approved / total) * 100 : 0,
      };
    }
  );

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
        .filter((value) => !value.toLowerCase().includes("unknown"))
        .sort(),
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
