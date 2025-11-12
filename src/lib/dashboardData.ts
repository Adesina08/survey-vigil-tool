import {
  sheetSubmissions,
  sheetStateTargets,
  sheetStateAgeTargets,
  sheetStateGenderTargets,
  type SheetSubmissionRow,
  type SheetStateTargetRow,
  type SheetStateAgeTargetRow,
  type SheetStateGenderTargetRow,
} from "@/data/sampleData";
import { applyQualityChecks, type ProcessedSubmissionRow } from "./qualityChecks";
import { normaliseHeaderKey } from "./googleSheets";
import { getSubmissionMetrics, type Row as MetricRow } from "@/utils/metrics";
import { getErrorBreakdown, extractQualityIndicatorCounts } from "@/utils/errors";
import { determineApprovalStatus } from "@/utils/approval";

type OgstepPath = "treatment" | "control" | "unknown";

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
  ogstepPath: OgstepPath;
  ogstepResponse: string | null;
  directions: string | null;
}

interface SummaryData {
  overallTarget: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  approvalRate: number;
  notApprovedSubmissions: number;
  notApprovedRate: number;
  latestSubmissionTime?: string | null;
  treatmentPathCount: number;
  controlPathCount: number;
  unknownPathCount: number;
}

interface StatusBreakdown {
  approved: number;
  notApproved: number;
}

interface PathCounts {
  treatment: number;
  control: number;
  unknown: number;
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

interface DetailedProductivityRow {
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

type ProductivityRow = {
  enumeratorId: string;
  enumeratorName: string;
  total: number;
  approved: number;
  flagged: number;
};

function buildUserProductivity(submissions: SheetSubmissionRow[]): ProductivityRow[] {
  const byUser = new Map<string, ProductivityRow>();

  const getKey = (row: SheetSubmissionRow) => {
    const rawId =
      (row["A1. Enumerator ID"] ||
        row["Interviewer ID"] ||
        row.username ||
        row.interviewer ||
        "")
        .toString()
        .trim();
    const id = rawId.length > 0 ? rawId : "Unknown";
    return `${id}|${id}`;
  };

  submissions.forEach((row) => {
    const key = getKey(row);
    if (!key || key === "|") {
      return;
    }

    const [enumeratorId, enumeratorName] = key.split("|");
    const existing =
      byUser.get(key) ??
      {
        enumeratorId,
        enumeratorName,
        total: 0,
        approved: 0,
        flagged: 0,
      };

    existing.total += 1;

    const approvalStatus = determineApprovalStatus(
      row as unknown as Record<string, unknown>,
    );
    if (approvalStatus === "Approved") {
      existing.approved += 1;
    } else {
      existing.flagged += 1;
    }

    byUser.set(key, existing);
  });

  return Array.from(byUser.values()).sort((a, b) => {
    if (b.approved !== a.approved) return b.approved - a.approved;
    if (a.flagged !== b.flagged) return a.flagged - b.flagged;
    if (b.total !== a.total) return b.total - a.total;
    return a.enumeratorId.localeCompare(b.enumeratorId);
  });
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
  treatmentPathCount: number;
  controlPathCount: number;
  unknownPathCount: number;
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
  userProductivityDetailed: DetailedProductivityRow[];
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

const normaliseTimePart = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const twelveHour = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (twelveHour) {
    let hours = Number.parseInt(twelveHour[1] ?? "0", 10);
    const minutes = Number.parseInt(twelveHour[2] ?? "0", 10);
    const seconds = Number.parseInt(twelveHour[3] ?? "0", 10) || 0;
    const modifier = (twelveHour[4] ?? "").toUpperCase();

    if (modifier === "PM" && hours < 12) {
      hours += 12;
    }
    if (modifier === "AM" && hours === 12) {
      hours = 0;
    }

    const padded = (num: number) => num.toString().padStart(2, "0");
    return `${padded(hours)}:${padded(minutes)}:${padded(seconds)}`;
  }

  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }

  return trimmed;
};

const parseDateCandidate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const withZone = new Date(`${value}Z`);
  if (!Number.isNaN(withZone.getTime())) {
    return withZone;
  }

  return null;
};

const parseSubmissionTimestamp = (row: SheetSubmissionRow): Date | null => {
  const dateValue = typeof row["Submission Date"] === "string" ? row["Submission Date"].trim() : "";
  const timeValue = normaliseTimePart(row["Submission Time"]);

  const candidates: Array<string | null | undefined> = [];

  if (dateValue) {
    if (timeValue) {
      candidates.push(`${dateValue}T${timeValue}`);
      candidates.push(`${dateValue} ${timeValue}`);
    } else {
      candidates.push(dateValue);
    }
  }

  candidates.push(
    typeof row._submission_time === "string" ? row._submission_time : null,
    typeof row.end === "string" ? row.end : null,
    typeof row.endtime === "string" ? row.endtime : null,
    typeof row.start === "string" ? row.start : null,
    typeof row.starttime === "string" ? row.starttime : null,
  );

  for (const candidate of candidates) {
    const parsed = parseDateCandidate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

const incrementMap = (map: Map<string, number>, key: string, amount = 1) => {
  map.set(key, (map.get(key) ?? 0) + amount);
};

const createEmptyPathCounts = (): PathCounts => ({ treatment: 0, control: 0, unknown: 0 });

const shouldIgnoreErrorType = (code: string): boolean => {
  if (!code) {
    return false;
  }
  return /^QC[\s_]*(?:FLAG|WARN)[\s_]*COUNT$/i.test(code.trim());
};

const determineOgstepPath = (response?: string | null): OgstepPath => {
  if (!response) {
    return "unknown";
  }

  const lower = response.trim().toLowerCase();
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

const extractOgstepDetails = (row: SheetSubmissionRow): { response: string | null; path: OgstepPath } => {
  const raw = row["B2. Did you participate in OGSTEP?"];
  if (raw === undefined || raw === null) {
    return { response: null, path: "unknown" };
  }

  const response = String(raw).trim();
  const normalised = response.length > 0 ? response : null;
  return { response: normalised, path: determineOgstepPath(normalised) };
};

const extractDirections = (row: SheetSubmissionRow): string | null => {
  const record = row as Record<string, unknown>;
  const preferredKeys = [
    "Directions",
    "Direction",
    "Location Directions",
    "Directions to Location",
    "Directions to location",
    "Direction to Location",
    "Direction to location",
    "Directions / Landmark",
    "Nearest Landmark / Directions",
  ];

  for (const key of preferredKeys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (!key || !key.toLowerCase().includes("direction")) {
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

const incrementPathCount = (counts: PathCounts, path: OgstepPath) => {
  if (path === "treatment") {
    counts.treatment += 1;
  } else if (path === "control") {
    counts.control += 1;
  } else {
    counts.unknown += 1;
  }
};

const incrementPathCountsMap = (map: Map<string, PathCounts>, key: string, path: OgstepPath) => {
  const counts = map.get(key) ?? createEmptyPathCounts();
  incrementPathCount(counts, path);
  map.set(key, counts);
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
    (row as unknown as Record<string, unknown>)["lga"],
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
  const enumeratorId = sanitiseText(row["A1. Enumerator ID"]);
  if (enumeratorId) {
    return enumeratorId;
  }

  const candidates = [
    row["Enumerator Name"],
    row["Interviewer Name"],
    (row as unknown as Record<string, unknown>)["interviewer_name"],
    (row as unknown as Record<string, unknown>)["enumerator_name"],
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

const getApprovalStatus = (row: SheetSubmissionRow) =>
  determineApprovalStatus(row as unknown as Record<string, unknown>);

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
  const requireGpsForApproval = false;
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

  const ogstepTotals: PathCounts = createEmptyPathCounts();
  const ogstepByState = new Map<string, PathCounts>();
  const ogstepByInterviewer = new Map<string, PathCounts>();
  const ogstepByLGA = new Map<string, PathCounts>();

  const errorCounts: Record<string, number> = {};

  const interviewerErrors = new Map<string, Record<string, number>>();

  const lgaSet = new Set<string>();
  const interviewerSet = new Set<string>();
  const errorTypeSet = new Set<string>();

  const mapSubmissions: Array<MapSubmission & { sortKey: number }> = [];
  let latestTimestamp: Date | null = null;

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
    const qualityIndicatorCounts = extractQualityIndicatorCounts(
      row as unknown as Record<string, unknown>,
    );
    const qualityIndicatorKeys = Object.keys(qualityIndicatorCounts);

    const manualErrorFlags = Array.isArray(row["Error Flags"])
      ? (row["Error Flags"] as unknown[])
      : [];
    const errorFlags = Array.from(
      new Set(
        qualityIndicatorKeys.concat(
          manualErrorFlags
            .map((flag) => (typeof flag === "string" ? flag : String(flag ?? "")))
            .filter((flag) => flag.length > 0 && !shouldIgnoreErrorType(flag)),
        ),
      ),
    ).filter((flag) => !shouldIgnoreErrorType(flag));
    const { response: ogstepResponse, path: ogstepPath } = extractOgstepDetails(row);

    const lat = getCoordinate(row, "lat");
    const lng = getCoordinate(row, "lng");

    const hasValidCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
    const hasValidLGA = typeof lga === "string" && lga.length > 0;

    incrementPathCount(ogstepTotals, ogstepPath);
    incrementPathCountsMap(ogstepByState, state, ogstepPath);
    incrementPathCountsMap(ogstepByInterviewer, interviewerId, ogstepPath);
    if (hasValidLGA) {
      incrementPathCountsMap(ogstepByLGA, `${state}|${lga}`, ogstepPath);
    }

    const submissionTimestamp = parseSubmissionTimestamp(row);
    if (submissionTimestamp && (!latestTimestamp || submissionTimestamp > latestTimestamp)) {
      latestTimestamp = submissionTimestamp;
    }

    if (hasValidLGA) {
      lgaSet.add(lga!);
    }
    if (interviewerId && interviewerId.toLowerCase() !== "unknown") {
      interviewerSet.add(interviewerId);
    }
    errorFlags
      .filter((flag) => !shouldIgnoreErrorType(flag))
      .forEach((flag) => errorTypeSet.add(flag));

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

    Object.entries(qualityIndicatorCounts).forEach(([errorType, value]) => {
      if (shouldIgnoreErrorType(errorType)) {
        return;
      }
      errorCounts[errorType] = getNumber(errorCounts[errorType]) + value;
      interviewerError[errorType] = getNumber(interviewerError[errorType]) + value;
    });

    manualErrorFlags
      .map((flag) => (typeof flag === "string" ? flag : String(flag ?? "")))
      .filter((flag) => flag.length > 0 && !shouldIgnoreErrorType(flag))
      .forEach((errorType) => {
        errorCounts[errorType] = getNumber(errorCounts[errorType]) + 1;
        interviewerError[errorType] = getNumber(interviewerError[errorType]) + 1;
      });

    interviewerErrors.set(interviewerId, interviewerError);

    if (hasValidCoordinates && hasValidLGA) {
      const rowIndex = getSubmissionIndex(row);
      const sortKey = submissionTimestamp?.getTime() ?? 0;
      const submissionId =
        sanitiseText(row["Submission ID"]) ??
        (rowIndex !== null ? String(rowIndex) : undefined) ??
        `${state}-${lga}-${sortKey || mapSubmissions.length}`;

      const timestampLabel = submissionTimestamp
        ? submissionTimestamp.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Timestamp unavailable";

      mapSubmissions.push({
        id: submissionId,
        lat,
        lng,
        interviewerId,
        interviewerName,
        interviewerLabel,
        lga: lga!,
        state,
        errorTypes: errorFlags.filter((flag) => !shouldIgnoreErrorType(flag)),
        timestamp: timestampLabel,
        status: approvalStatus === "Approved" ? "approved" : "not_approved",
        sortKey,
        ogstepPath,
        ogstepResponse: ogstepResponse,
        directions: extractDirections(row),
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

  const userProductivityDetailed: DetailedProductivityRow[] = [...totalsByInterviewer.entries()]
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

  const userProductivity = buildUserProductivity(submissions);

  const rowErrorCounts = getErrorBreakdown(metricsRows);
  const finalErrorCounts: Record<string, number> = { ...errorCounts };

  Object.entries(rowErrorCounts).forEach(([code, count]) => {
    if (shouldIgnoreErrorType(code)) {
      return;
    }
    finalErrorCounts[code] = (finalErrorCounts[code] ?? 0) + count;
  });

  const cleanedErrorCounts = Object.fromEntries(
    Object.entries(finalErrorCounts).filter(([code]) => !shouldIgnoreErrorType(code)),
  );

  Object.keys(cleanedErrorCounts).forEach((code) => errorTypeSet.add(code));

  const totalErrorEvents = Object.values(cleanedErrorCounts).reduce((sum, value) => sum + value, 0);
  const errorBreakdown: ErrorBreakdownRow[] = Object.entries(cleanedErrorCounts)
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
    const pathCounts = ogstepByState.get(state) ?? createEmptyPathCounts();

    return {
      state,
      total: computedTotal,
      approved,
      notApproved,
      percentageApproved: computedTotal > 0 ? (approved / computedTotal) * 100 : 0,
      treatmentPathCount: pathCounts.treatment,
      controlPathCount: pathCounts.control,
      unknownPathCount: pathCounts.unknown,
    };
  });

  const achievementsByInterviewer: AchievementByInterviewerRow[] = [...totalsByInterviewer.entries()].map(
    ([interviewerId, total]) => {
      const approved = approvedByInterviewer.get(interviewerId) ?? 0;
      const notApproved = notApprovedByInterviewer.get(interviewerId) ?? (total - approved);
      const name = interviewerNames.get(interviewerId) ?? "";
      const label = name && name !== interviewerId ? `${interviewerId} · ${name}` : interviewerId;
      const pathCounts = ogstepByInterviewer.get(interviewerId) ?? createEmptyPathCounts();

      return {
        interviewerId,
        interviewerName: name || interviewerId,
        displayLabel: label,
        total,
        approved,
        notApproved,
        percentageApproved: total > 0 ? (approved / total) * 100 : 0,
        treatmentPathCount: pathCounts.treatment,
        controlPathCount: pathCounts.control,
        unknownPathCount: pathCounts.unknown,
      };
    }
  ).filter((row) => row.interviewerId.toLowerCase() !== "unknown");

  const achievementsByLGA: AchievementByLGARow[] = [...totalsByLGA.entries()].map(([key, total]) => {
    const [state, lga] = key.split("|");
    const approved = approvedByLGA.get(key) ?? 0;
    const notApproved = notApprovedByLGA.get(key) ?? (total - approved);
    const computedTotal = approved + notApproved;
    const pathCounts = ogstepByLGA.get(key) ?? createEmptyPathCounts();

    return {
      lga,
      state,
      total: computedTotal,
      approved,
      notApproved,
      percentageApproved: computedTotal > 0 ? (approved / computedTotal) * 100 : 0,
      treatmentPathCount: pathCounts.treatment,
      controlPathCount: pathCounts.control,
      unknownPathCount: pathCounts.unknown,
    };
  });

  const summary: SummaryData = {
    overallTarget,
    totalSubmissions,
    approvedSubmissions: totalApproved,
    approvalRate: Number(approvalRate.toFixed(1)),
    notApprovedSubmissions: totalNotApproved,
    notApprovedRate: Number(notApprovedRate.toFixed(1)),
    treatmentPathCount: ogstepTotals.treatment,
    controlPathCount: ogstepTotals.control,
    unknownPathCount: ogstepTotals.unknown,
  };

  const statusBreakdown: StatusBreakdown = {
    approved: totalApproved,
    notApproved: totalNotApproved,
  };

  const sortedMapSubmissions = mapSubmissions
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ sortKey, ...entry }) => entry);

  const lastUpdated = latestTimestamp
    ? latestTimestamp.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : totalSubmissions > 0
      ? "Timestamp unavailable"
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
    userProductivityDetailed,
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
