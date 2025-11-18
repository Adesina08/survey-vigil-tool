import type {
  SheetSubmissionRow,
  SheetStateTargetRow,
  SheetStateAgeTargetRow,
  SheetStateGenderTargetRow,
} from "@/types/sheets";
import { applyQualityChecks, type ProcessedSubmissionRow } from "./qualityChecks";
import { normaliseHeaderKey } from "./googleSheets";
import { normaliseErrorType } from "./errorTypes";
import { getSubmissionMetrics, type Row as MetricRow } from "@/utils/metrics";
import {
  getErrorBreakdown,
  extractQualityIndicatorCounts,
  collectQualityIndicatorLabels,
} from "@/utils/errors";
import { determineApprovalStatus, findApprovalFieldValue } from "@/utils/approval";
import {
  normalizeMapMetadata,
  type MapMetadataConfig,
  type NormalizedMapMetadata,
} from "./mapMetadata";

type OgstepPath = "treatment" | "control" | "unknown" | null;

const QC_FLAG_REGEX = /^QC_(FLAG|WARN)_/i;

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
  qcFlags: string[];
  otherFlags: string[];
  timestamp: string;
  status: "approved" | "not_approved";
  approvalLabel: string;
  approvalSource: string | null;
  ogstepPath: OgstepPath;
  ogstepResponse: string | null;
  directions: string | null;
  respondentName: string | null;
  respondentPhone: string | null;
  respondentGender: string | null;
  respondentAge: string | null;
  ward: string | null;
  community: string | null;
  consent: string | null;
  qcStatus: string | null;
}

interface SummaryData {
  overallTarget: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  approvalRate: number;
  notApprovedSubmissions: number;
  notApprovedRate: number;
  completionRate: number;
  latestSubmissionTime?: string | null;
  treatmentPathCount: number;
  controlPathCount: number;
  unknownPathCount: number;
  maleCount: number;
  femaleCount: number;
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

export interface ErrorBreakdownRow {
  errorType: string;
  count: number;
  percentage: number;
  relatedVariables?: string[];
  code?: string;
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
  mapMetadata: NormalizedMapMetadata;
  userProductivity: ProductivityRow[];
  userProductivityDetailed: DetailedProductivityRow[];
  errorBreakdown: ErrorBreakdownRow[];
  achievements: {
    byState: AchievementByStateRow[];
    byInterviewer: AchievementByInterviewerRow[];
    byLGA: AchievementByLGARow[];
  };
  lgas: string[];
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

const OGSTEP_PILLAR_FIELD =
  "Pillar. Interviewers,  kindly recruit the respondent into the right Pillar according to your target";

const determineOgstepPath = (pillar?: string | null): OgstepPath => {
  if (!pillar) {
    return null;
  }

  const upper = pillar.trim().toUpperCase();
  if (!upper) {
    return null;
  }

  if (upper.includes("TREATMENT")) {
    return "treatment";
  }

  if (upper.includes("CONTROL")) {
    return "control";
  }

  if (upper.includes("UNQUALIFIED")) {
    return "unknown";
  }

  return null;
};

const extractOgstepDetails = (row: SheetSubmissionRow): { response: string | null; path: OgstepPath } => {
  const rawResponse = row["B2. Did you participate in OGSTEP?"];
  const rawPillar = row[OGSTEP_PILLAR_FIELD];
  const pillar = typeof rawPillar === "string" ? rawPillar : null;

  if (rawResponse === undefined || rawResponse === null) {
    return { response: null, path: determineOgstepPath(pillar) };
  }

  const response = String(rawResponse).trim();
  const normalised = response.length > 0 ? response : null;
  return { response: normalised, path: determineOgstepPath(pillar) };
};

const extractDirections = (row: SheetSubmissionRow): string | null => {
  const record = row as Record<string, unknown>;

  // 1) Exact key "Direction" takes precedence
  if (typeof record["Direction"] === "string") {
    const trimmed = (record["Direction"] as string).trim();
    if (trimmed.length > 0) return trimmed;
  }

  // 2) Otherwise check common variants you already had
  const preferredKeys = [
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

  // 3) Fallback: any key that includes "direction"
  for (const [key, value] of Object.entries(record)) {
    if (!key || !key.toLowerCase().includes("direction")) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  return null;
};

const incrementPathCount = (counts: PathCounts, path: OgstepPath) => {
  if (path === "treatment") {
    counts.treatment += 1;
  } else if (path === "control") {
    counts.control += 1;
  } else if (path === "unknown") {
    counts.unknown += 1;
  }
};

const incrementPathCountsMap = (map: Map<string, PathCounts>, key: string, path: OgstepPath) => {
  if (!path) {
    return;
  }

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

const pickFirstText = (row: SheetSubmissionRow, keys: string[]): string | null => {
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    const cleaned = sanitiseText(value);
    if (cleaned) {
      return cleaned;
    }
  }
  return null;
};

const collectQcFlagSlugs = (row: SheetSubmissionRow): string[] => {
  const record = row as Record<string, unknown>;
  const slugs = new Set<string>();

  Object.entries(record).forEach(([key, value]) => {
    if (!QC_FLAG_REGEX.test(key)) {
      return;
    }

    const numericValue = parseNumeric(value);
    if (numericValue && numericValue > 0) {
      const slug = normaliseErrorType(key).slug;
      if (slug.length > 0) {
        slugs.add(slug);
      }
    }
  });

  return Array.from(slugs);
};

const normaliseGenderValue = (value: unknown): "male" | "female" | null => {
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (normalised.startsWith("m")) {
      return "male";
    }
    if (normalised.startsWith("f")) {
      return "female";
    }
  }

  if (value === "Male" || value === "male") {
    return "male";
  }
  if (value === "Female" || value === "female") {
    return "female";
  }

  return null;
};

const getRespondentGenderLabel = (row: SheetSubmissionRow): string | null => {
  const normalised = getGender(row);
  if (normalised === "male") {
    return "Male";
  }
  if (normalised === "female") {
    return "Female";
  }

  return pickFirstText(row, [
    "A7. Sex",
    "Gender",
    "gender",
    "respondent_gender",
    "respondent sex",
  ]);
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

const getGender = (row: SheetSubmissionRow): "male" | "female" | null => {
  const candidates: Array<unknown> = [
    row.Gender,
    (row as Record<string, unknown>)["A7. Sex"],
    (row as Record<string, unknown>)["a7_sex"],
    (row as Record<string, unknown>)["gender"],
    (row as Record<string, unknown>)["respondent_gender"],
    (row as Record<string, unknown>)["respondent sex"],
  ];

  for (const candidate of candidates) {
    const gender = normaliseGenderValue(candidate);
    if (gender) {
      return gender;
    }
  }

  return null;
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

const getApprovalField = (row: SheetSubmissionRow) =>
  findApprovalFieldValue(row as unknown as Record<string, unknown>);

interface DashboardDataInput {
  submissions: SheetSubmissionRow[];
  stateTargets?: SheetStateTargetRow[];
  stateAgeTargets?: SheetStateAgeTargetRow[];
  stateGenderTargets?: SheetStateGenderTargetRow[];
  analysisRows?: AnalysisRow[];
  mapMetadata?: MapMetadataConfig;
}

export const buildDashboardData = ({
  submissions,
  stateTargets = [],
  stateAgeTargets = [],
  stateGenderTargets = [],
  analysisRows,
  mapMetadata,
}: DashboardDataInput): DashboardData => {
  const safeSubmissions = Array.isArray(submissions) && submissions.length > 0 ? submissions : [];

  console.log("🔍 Building dashboard with submissions:", safeSubmissions.length);

  if (safeSubmissions.length === 0) {
    console.warn("⚠️ No submissions data available - returning empty dashboard");
    return createEmptyDashboardData();
  }

  const metricsRows: MetricRow[] = Array.isArray(analysisRows)
    ? (analysisRows as MetricRow[])
    : (safeSubmissions as unknown as MetricRow[]);
  const requireGpsForApproval = false;
  const metrics = getSubmissionMetrics(metricsRows, requireGpsForApproval);

  const processedSubmissions: ProcessedSubmissionRow[] = applyQualityChecks(safeSubmissions);
  const totalSubmissions = metrics.total;
  const normalizedMapMetadata = normalizeMapMetadata(mapMetadata);

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
  const errorSlugToLabel = new Map<string, string>();

  const lgaSet = new Set<string>();
  const interviewerSet = new Set<string>();
  const errorTypeSet = new Set<string>();

  const mapSubmissions: Array<MapSubmission & { sortKey: number }> = [];
  let latestTimestamp: Date | null = null;
  let maleCount = 0;
  let femaleCount = 0;

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
    const qualityIndicatorLabels = collectQualityIndicatorLabels(
      row as unknown as Record<string, unknown>,
    );
    Object.entries(qualityIndicatorLabels).forEach(([slug, label]) => {
      if (slug && label) {
        const trimmedLabel = label.trim();
        if (trimmedLabel.length > 0) {
          errorSlugToLabel.set(slug, trimmedLabel);
        }
      }
    });
    const qualityIndicatorKeys = Object.keys(qualityIndicatorCounts);

    Object.keys(row).forEach((key) => {
      if (!QC_FLAG_REGEX.test(key)) {
        return;
      }

      if (/count$/i.test(key.trim())) {
        return;
      }

      const slug = normaliseErrorType(key).slug;
      if (slug.length > 0) {
        errorTypeSet.add(slug);
      }
    });

    const qcFlagSlugs = collectQcFlagSlugs(row);
    const manualErrorFlags = Array.isArray(row["Error Flags"])
      ? (row["Error Flags"] as unknown[])
      : [];
    const manualErrorSlugs = manualErrorFlags
      .map((flag) => (typeof flag === "string" ? flag : String(flag ?? "")))
      .filter((flag) => flag.length > 0 && !shouldIgnoreErrorType(flag))
      .map((flag) => normaliseErrorType(flag).slug)
      .filter((slug) => slug.length > 0);
    const qualityIndicatorSlugs = qualityIndicatorKeys
      .filter((key) => !shouldIgnoreErrorType(key))
      .map((key) => normaliseErrorType(key).slug)
      .filter((slug) => slug.length > 0);

    const combinedFlagSet = new Set<string>();
    qualityIndicatorSlugs.forEach((slug) => {
      combinedFlagSet.add(slug);
      if (!errorSlugToLabel.has(slug)) {
        const label = normaliseErrorType(slug).label;
        if (label.trim().length > 0) {
          errorSlugToLabel.set(slug, label);
        }
      }
    });
    manualErrorSlugs.forEach((slug) => {
      combinedFlagSet.add(slug);
      if (!errorSlugToLabel.has(slug)) {
        const label = normaliseErrorType(slug).label;
        if (label.trim().length > 0) {
          errorSlugToLabel.set(slug, label);
        }
      }
    });
    qcFlagSlugs.forEach((slug) => {
      combinedFlagSet.add(slug);
      if (!errorSlugToLabel.has(slug)) {
        const label = normaliseErrorType(slug).label;
        if (label.trim().length > 0) {
          errorSlugToLabel.set(slug, label);
        }
      }
    });

    const qualityFlags = Array.from(new Set(qcFlagSlugs));
    const otherFlags = Array.from(combinedFlagSet).filter((slug) => !qualityFlags.includes(slug));
    const combinedFlags = Array.from(combinedFlagSet);
    const { response: ogstepResponse, path: ogstepPath } = extractOgstepDetails(row);

    const respondentName = pickFirstText(row, [
      "Respondent name",
      "respondent_name",
      "Name of respondent",
    ]);
    const respondentPhone = pickFirstText(row, [
      "Respondent phone number",
      "respondent_phone_number",
      "Respondent Phone",
      "phone",
    ]);
    const respondentGenderLabel = getRespondentGenderLabel(row);
    const respondentAge = pickFirstText(row, ["A8. Age", "respondent_age", "Age"]);
    const wardName = pickFirstText(row, ["A3b. Select the Ward", "Ward"]);
    const communityName = pickFirstText(row, ["A4. Community / Village", "Community", "Village"]);
    const consentValue = pickFirstText(row, ["A6. Consent to participate", "Consent"]);
    const qcStatusLabel = pickFirstText(row, ["QC Status", "qc_status"]);

    const genderValue = getGender(row);
    if (genderValue === "male") {
      maleCount += 1;
    } else if (genderValue === "female") {
      femaleCount += 1;
    }

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
    combinedFlags
      .filter((slug) => slug.length > 0)
      .forEach((slug) => errorTypeSet.add(slug));

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
      const slug = normaliseErrorType(errorType).slug;
      if (!slug) {
        return;
      }
      if (!errorSlugToLabel.has(slug)) {
        const label = qualityIndicatorLabels[slug] ?? normaliseErrorType(slug).label;
        if (label.trim().length > 0) {
          errorSlugToLabel.set(slug, label);
        }
      }
      errorCounts[slug] = getNumber(errorCounts[slug]) + value;
      interviewerError[slug] = getNumber(interviewerError[slug]) + value;
    });

    manualErrorSlugs.forEach((slug) => {
      if (!slug) {
        return;
      }
      if (!errorSlugToLabel.has(slug)) {
        const label = normaliseErrorType(slug).label;
        if (label.trim().length > 0) {
          errorSlugToLabel.set(slug, label);
        }
      }
      errorCounts[slug] = getNumber(errorCounts[slug]) + 1;
      interviewerError[slug] = getNumber(interviewerError[slug]) + 1;
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

      const approvalField = getApprovalField(row);
      const approvalLabel = approvalField?.value ?? approvalStatus;
      const approvalSource = approvalField?.key ?? null;
      const normalisedStatus = approvalStatus === "Approved" ? "approved" : "not_approved";

      mapSubmissions.push({
        id: submissionId,
        lat,
        lng,
        interviewerId,
        interviewerName,
        interviewerLabel,
        lga: lga!,
        state,
        errorTypes: combinedFlags,
        qcFlags: qualityFlags,
        otherFlags,
        timestamp: timestampLabel,
        status: normalisedStatus,
        approvalLabel,
        approvalSource,
        sortKey,
        ogstepPath,
        ogstepResponse: ogstepResponse,
        directions: extractDirections(row),
        respondentName: respondentName ?? null,
        respondentPhone: respondentPhone ?? null,
        respondentGender: respondentGenderLabel ?? null,
        respondentAge: respondentAge ?? null,
        ward: wardName ?? null,
        community: communityName ?? null,
        consent: consentValue ?? null,
        qcStatus: qcStatusLabel ?? null,
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

  const userProductivity = buildUserProductivity(safeSubmissions);

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
    .map(([slug, count]) => {
      const info = normaliseErrorType(slug);
      const displayLabel = errorSlugToLabel.get(info.slug) ?? info.label;
      return {
        errorType: displayLabel,
        count,
        percentage: totalErrorEvents > 0 ? (count / totalErrorEvents) * 100 : 0,
        relatedVariables: info.relatedVariables,
        code: info.slug,
      };
    });

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

  const achievementsByInterviewer: AchievementByInterviewerRow[] = [...totalsByInterviewer.entries()]
    .map(([interviewerId, total]) => {
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
        percentageApproved: total > 0 ? Number(((approved / total) * 100).toFixed(1)) : 0,
        treatmentPathCount: pathCounts.treatment,
        controlPathCount: pathCounts.control,
        unknownPathCount: pathCounts.unknown,
      };
    })
    .filter((row) => row.interviewerId.toLowerCase() !== "unknown");

  console.log("✅ Achievements by interviewer:", achievementsByInterviewer.length);

  const achievementsByLGA: AchievementByLGARow[] = [...totalsByLGA.entries()].map(([key, total]) => {
    const [state, lga] = key.split("|");
    const approved = approvedByLGA.get(key) ?? 0;
    const notApproved = notApprovedByLGA.get(key) ?? (total - approved);
    const computedTotal = approved + notApproved;
    const pathCounts = ogstepByLGA.get(key) ?? createEmptyPathCounts();

    return {
      lga: lga ?? "Unknown",
      state: state ?? "Unknown",
      total: computedTotal,
      approved,
      notApproved,
      percentageApproved: computedTotal > 0 ? Number(((approved / computedTotal) * 100).toFixed(1)) : 0,
      treatmentPathCount: pathCounts.treatment,
      controlPathCount: pathCounts.control,
      unknownPathCount: pathCounts.unknown,
    };
  });

  console.log("✅ Achievements by LGA:", achievementsByLGA.length);

  const summary: SummaryData = {
    overallTarget,
    totalSubmissions,
    approvedSubmissions: totalApproved,
    approvalRate: Number(approvalRate.toFixed(1)),
    notApprovedSubmissions: totalNotApproved,
    notApprovedRate: Number(notApprovedRate.toFixed(1)),
    completionRate: Number(quotaProgress.toFixed(1)),
    treatmentPathCount: ogstepTotals.treatment,
    controlPathCount: ogstepTotals.control,
    unknownPathCount: ogstepTotals.unknown,
    maleCount,
    femaleCount,
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
    safeSubmissions.map((row) => {
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

  const finalDashboard: DashboardData = {
    summary,
    statusBreakdown,
    quotaProgress: Number(quotaProgress.toFixed(1)),
    quotaByLGA,
    quotaByLGAAge,
    quotaByLGAGender,
    mapSubmissions: sortedMapSubmissions,
    mapMetadata: normalizedMapMetadata,
    userProductivity,
    userProductivityDetailed,
    errorBreakdown,
    achievements: {
      byState: achievementsByState,
      byInterviewer: achievementsByInterviewer.length > 0 ? achievementsByInterviewer : [],
      byLGA: achievementsByLGA.length > 0 ? achievementsByLGA : [],
    },
    lgas: Array.from(lgaSet)
      .filter((value) => value && value.toLowerCase() !== "unknown")
      .sort(),
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
 
  console.log("✅ Final dashboard data:", {
    totalSubmissions: finalDashboard.summary.totalSubmissions,
    byInterviewer: finalDashboard.achievements.byInterviewer.length,
    byLGA: finalDashboard.achievements.byLGA.length,
  });

  return finalDashboard;
};

function createEmptyDashboardData(): DashboardData {
  return {
    summary: {
      overallTarget: 0,
      totalSubmissions: 0,
      approvedSubmissions: 0,
      approvalRate: 0,
      notApprovedSubmissions: 0,
      notApprovedRate: 0,
      completionRate: 0,
      treatmentPathCount: 0,
      controlPathCount: 0,
      unknownPathCount: 0,
      maleCount: 0,
      femaleCount: 0,
    },
    statusBreakdown: {
      approved: 0,
      notApproved: 0,
    },
    quotaProgress: 0,
    quotaByLGA: [],
    quotaByLGAAge: [],
    quotaByLGAGender: [],
    mapSubmissions: [],
    mapMetadata: normalizeMapMetadata(),
    userProductivity: [],
    userProductivityDetailed: [],
    errorBreakdown: [],
    achievements: {
      byState: [],
      byInterviewer: [],
      byLGA: [],
    },
    lgas: [],
    filters: {
      lgas: [],
      interviewers: [],
      errorTypes: [],
    },
    lastUpdated: "No data available",
    analysisRows: [],
  };
}

