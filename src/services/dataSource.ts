// src/services/dataSource.ts
import { fetchAllSurveyRows } from "./googleSheets";
import { normalizeMapMetadata } from "@/lib/mapMetadata";
import type { AnalysisRow, DashboardData, ErrorBreakdownRow } from "@/lib/dashboardData";

type RawRow = Record<string, unknown>;

type OgstepPath = "treatment" | "control" | "unknown";

const DEFAULT_STATE = "Ogun State";

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toStringValue = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

const getFirstTextValue = (row: RawRow, keys: string[]): string | null => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

const getLga = (row: RawRow): string =>
  (
    getFirstTextValue(row, [
      "A3. select the LGA",
      "A3. Select the LGA",
      "A3. select the lga",
      "A3. Select the lga",
      "A3. Select The Lga",
      "lga",
      "LGA",
    ]) ?? ""
  ).trim();

const getState = (row: RawRow): string => {
  const value = toStringValue(row["State"]).trim();
  return value.length > 0 ? value : DEFAULT_STATE;
};

const getApproval = (row: RawRow): string => toStringValue(row["Approval"]).trim();

const isApprovedRow = (row: RawRow): boolean => getApproval(row).toLowerCase() === "approved";

const getSex = (row: RawRow): string => toStringValue(row["A7. Sex"]).trim();

const getAge = (row: RawRow): number => toNumber(row["A8. Age"]);

const getLat = (row: RawRow): number | null =>
  toNumberOrNull(
    row["_A5. GPS Coordinates_latitude"] ??
      row["A5. GPS Coordinates_latitude"] ??
      row.Latitude ??
      row.latitude ??
      row.lat,
  );

const getLng = (row: RawRow): number | null =>
  toNumberOrNull(
    row["_A5. GPS Coordinates_longitude"] ??
      row["A5. GPS Coordinates_longitude"] ??
      row.Longitude ??
      row.longitude ??
      row.lng,
  );

const getInterviewerId = (row: RawRow): string =>
  (
    getFirstTextValue(row, [
      "A1. Enumerator ID",
      "Interviewer ID",
      "Enumerator ID",
      "username",
      "interviewer_id",
      "enumerator_id",
    ]) ?? "Unknown"
  ).trim() || "Unknown";

const getOgstepResponse = (row: RawRow): string | null =>
  getFirstTextValue(row, [
    "B2. Did you participate in OGSTEP?",
    "b2_did_you_participate_in_ogstep",
    "did_you_participate_in_ogstep",
    "ogstep",
    "ogstep_participation",
    "ogstep_response",
  ]);

const determineOgstepPath = (response: string | null): OgstepPath => {
  if (!response) return "unknown";
  const lower = response.trim().toLowerCase();
  if (!lower) return "unknown";
  if (lower.startsWith("y") || lower === "1" || lower === "true" || lower === "yes") return "treatment";
  if (lower.startsWith("n") || lower === "0" || lower === "false" || lower === "no") return "control";
  return "unknown";
};

const directionKeys = [
  "Direction",
  "Location Directions",
  "Directions to Location",
  "Directions to location",
  "Direction to Location",
  "Direction to location",
  "Directions / Landmark",
  "Nearest Landmark / Directions",
];

const getDirections = (row: RawRow): string | null => {
  for (const key of directionKeys) {
    const value = row[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  for (const [key, value] of Object.entries(row)) {
    if (!key.toLowerCase().includes("direction")) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
};

const parseTimestamp = (row: RawRow): Date | null => {
  const candidates: Array<string | null | undefined> = [
    toStringValue(row["_submission_time"]).trim() || null,
  ];

  const submissionDate = getFirstTextValue(row, ["Submission Date", "submission_date"]);
  const submissionTime = getFirstTextValue(row, ["Submission Time", "submission_time"]);
  if (submissionDate) {
    if (submissionTime) {
      candidates.push(`${submissionDate}T${submissionTime}`);
      candidates.push(`${submissionDate} ${submissionTime}`);
    } else {
      candidates.push(submissionDate);
    }
  }

  candidates.push(
    getFirstTextValue(row, ["end", "endtime"]),
    getFirstTextValue(row, ["start", "starttime"]),
  );

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    const zoned = new Date(`${candidate}Z`);
    if (!Number.isNaN(zoned.getTime())) {
      return zoned;
    }
  }

  return null;
};

const formatTimestamp = (timestamp: Date | null): string => {
  if (!timestamp) {
    return "Timestamp unavailable";
  }

  return timestamp.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const collectErrorInfo = (rows: RawRow[]) => {
  const set = new Set<string>();
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (!key.startsWith("QC_FLAG_") && !key.startsWith("QC_WARN_")) {
        return;
      }
      const numeric = toNumber(value);
      if (numeric > 0) {
        set.add(key);
        counts.set(key, (counts.get(key) ?? 0) + numeric);
      }
    });
  });

  return { errorTypes: Array.from(set).sort(), errorCounts: counts };
};

const buildErrorBreakdown = (counts: Map<string, number>): ErrorBreakdownRow[] => {
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return [];
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([errorType, count]) => ({
      errorType,
      count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
    }));
};

const buildQuotaByLGA = (rows: RawRow[]) => {
  const map = new Map<string, { state: string; lga: string; achieved: number }>();

  rows.forEach((row) => {
    const lga = getLga(row);
    if (!lga) return;
    const state = getState(row);
    const key = `${state}|${lga}`;
    if (!map.has(key)) {
      map.set(key, { state, lga, achieved: 0 });
    }
    if (isApprovedRow(row)) {
      const entry = map.get(key)!;
      entry.achieved += 1;
    }
  });

  return Array.from(map.values())
    .map(({ state, lga, achieved }) => {
      const target = 0;
      return {
        state,
        lga,
        target,
        achieved,
        balance: Math.max(target - achieved, 0),
      };
    })
    .sort((a, b) => a.lga.localeCompare(b.lga));
};

const ageBand = (age: number): string => {
  if (!Number.isFinite(age) || age <= 0) return "Unknown";
  if (age < 18) return "<18";
  if (age <= 24) return "18–24";
  if (age <= 35) return "25–35";
  if (age <= 49) return "36–49";
  return "50+";
};

const buildQuotaByLGAAge = (rows: RawRow[]) => {
  const map = new Map<string, { state: string; lga: string; ageGroup: string; achieved: number }>();

  rows.forEach((row) => {
    const lga = getLga(row);
    if (!lga) return;
    const state = getState(row);
    const group = ageBand(getAge(row));
    const key = `${state}|${lga}|${group}`;
    if (!map.has(key)) {
      map.set(key, { state, lga, ageGroup: group, achieved: 0 });
    }
    if (isApprovedRow(row)) {
      const entry = map.get(key)!;
      entry.achieved += 1;
    }
  });

  return Array.from(map.values()).map(({ state, lga, ageGroup, achieved }) => {
    const target = 0;
    return {
      state,
      lga,
      ageGroup,
      target,
      achieved,
      balance: Math.max(target - achieved, 0),
    };
  });
};

const buildQuotaByLGAGender = (rows: RawRow[]) => {
  const map = new Map<string, { state: string; lga: string; gender: string; achieved: number }>();

  rows.forEach((row) => {
    const lga = getLga(row);
    if (!lga) return;
    const state = getState(row);
    const gender = getSex(row) || "Unknown";
    const key = `${state}|${lga}|${gender}`;
    if (!map.has(key)) {
      map.set(key, { state, lga, gender, achieved: 0 });
    }
    if (isApprovedRow(row)) {
      const entry = map.get(key)!;
      entry.achieved += 1;
    }
  });

  return Array.from(map.values()).map(({ state, lga, gender, achieved }) => {
    const target = 0;
    return {
      state,
      lga,
      gender,
      target,
      achieved,
      balance: Math.max(target - achieved, 0),
    };
  });
};

const buildMapSubmissions = (rows: RawRow[]): DashboardData["mapSubmissions"] => {
  const submissions: DashboardData["mapSubmissions"] = [];

  rows.forEach((row) => {
    const lat = getLat(row);
    const lng = getLng(row);
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      return;
    }

    const interviewerId = getInterviewerId(row);
    const ogstepResponse = getOgstepResponse(row);
    const ogstepPath = determineOgstepPath(ogstepResponse);
    const approval = isApprovedRow(row) ? "approved" : "not_approved";
    const timestamp = parseTimestamp(row);

    const errorTypes = Object.entries(row)
      .filter(
        ([key, value]) =>
          (key.startsWith("QC_FLAG_") || key.startsWith("QC_WARN_")) && toNumber(value) > 0,
      )
      .map(([key]) => key)
      .sort();

    const submissionId =
      toStringValue(row["_uuid"]).trim() ||
      toStringValue(row["_id"]).trim() ||
      toStringValue(row["_index"]).trim() ||
      `${lat},${lng}`;

    submissions.push({
      id: submissionId,
      lat,
      lng,
      interviewerId,
      interviewerName: interviewerId,
      interviewerLabel: interviewerId,
      lga: getLga(row),
      state: getState(row),
      errorTypes,
      timestamp: formatTimestamp(timestamp),
      status: approval,
      ogstepPath,
      ogstepResponse: ogstepResponse ?? null,
      directions: getDirections(row),
    });
  });

  return submissions;
};

const buildAchievementsByState = (rows: RawRow[]) => {
  const map = new Map<
    string,
    {
      total: number;
      approved: number;
      notApproved: number;
      treatmentPathCount: number;
      controlPathCount: number;
      unknownPathCount: number;
    }
  >();

  rows.forEach((row) => {
    const state = getState(row);
    const ogstepPath = determineOgstepPath(getOgstepResponse(row));
    const entry =
      map.get(state) ?? {
        total: 0,
        approved: 0,
        notApproved: 0,
        treatmentPathCount: 0,
        controlPathCount: 0,
        unknownPathCount: 0,
      };

    entry.total += 1;
    if (isApprovedRow(row)) {
      entry.approved += 1;
    } else {
      entry.notApproved += 1;
    }

    if (ogstepPath === "treatment") entry.treatmentPathCount += 1;
    else if (ogstepPath === "control") entry.controlPathCount += 1;
    else entry.unknownPathCount += 1;

    map.set(state, entry);
  });

  return Array.from(map.entries())
    .map(([state, value]) => ({
      state,
      total: value.total,
      approved: value.approved,
      notApproved: value.notApproved,
      percentageApproved: value.total > 0 ? Number(((value.approved / value.total) * 100).toFixed(1)) : 0,
      treatmentPathCount: value.treatmentPathCount,
      controlPathCount: value.controlPathCount,
      unknownPathCount: value.unknownPathCount,
    }))
    .sort((a, b) => a.state.localeCompare(b.state));
};

const buildFilters = (rows: RawRow[], errorTypes: string[]) => {
  const lgas = new Set<string>();
  const interviewers = new Map<string, { id: string; name: string; label: string }>();

  rows.forEach((row) => {
    const lga = getLga(row);
    if (lga) {
      lgas.add(lga);
    }

    const interviewerId = getInterviewerId(row);
    if (!interviewerId || interviewerId.toLowerCase() === "unknown") {
      return;
    }

    if (!interviewers.has(interviewerId)) {
      interviewers.set(interviewerId, {
        id: interviewerId,
        name: interviewerId,
        label: interviewerId,
      });
    }
  });

  return {
    lgas: Array.from(lgas).sort((a, b) => a.localeCompare(b)),
    interviewers: Array.from(interviewers.values()).sort((a, b) => a.id.localeCompare(b.id)),
    errorTypes,
  };
};

const computeLastUpdated = (rows: RawRow[]): { label: string; summaryValue: string | null } => {
  let latest: Date | null = null;
  rows.forEach((row) => {
    const timestamp = parseTimestamp(row);
    if (!timestamp) return;
    if (!latest || timestamp > latest) {
      latest = timestamp;
    }
  });

  if (!latest) {
    return { label: "No data available", summaryValue: null };
  }

  return {
    label: formatTimestamp(latest),
    summaryValue: latest.toISOString(),
  };
};

export async function fetchDashboardData(): Promise<DashboardData> {
  const submissions = (await fetchAllSurveyRows()) as AnalysisRow[];

  const quotaByLGA = buildQuotaByLGA(submissions);
  const quotaByLGAAge = buildQuotaByLGAAge(submissions);
  const quotaByLGAGender = buildQuotaByLGAGender(submissions);
  const mapSubmissions = buildMapSubmissions(submissions);
  const { errorTypes, errorCounts } = collectErrorInfo(submissions);
  const errorBreakdown = buildErrorBreakdown(errorCounts);
  const achievementsByState = buildAchievementsByState(submissions);
  const filters = buildFilters(submissions, errorTypes);
  const lastUpdatedInfo = computeLastUpdated(submissions);

  const totalSubmissions = submissions.length;
  const approvedSubmissions = submissions.filter(isApprovedRow).length;
  const notApprovedSubmissions = totalSubmissions - approvedSubmissions;

  const overallTarget = quotaByLGA.reduce((sum, row) => sum + row.target, 0);
  const approvalRate =
    totalSubmissions > 0 ? Number(((approvedSubmissions / totalSubmissions) * 100).toFixed(1)) : 0;
  const notApprovedRate =
    totalSubmissions > 0 ? Number(((notApprovedSubmissions / totalSubmissions) * 100).toFixed(1)) : 0;

  const pathTotals = submissions.reduce(
    (acc, row) => {
      const path = determineOgstepPath(getOgstepResponse(row));
      if (path === "treatment") acc.treatment += 1;
      else if (path === "control") acc.control += 1;
      else acc.unknown += 1;
      return acc;
    },
    { treatment: 0, control: 0, unknown: 0 },
  );

  const summary: DashboardData["summary"] = {
    overallTarget,
    totalSubmissions,
    approvedSubmissions,
    approvalRate,
    notApprovedSubmissions,
    notApprovedRate,
    latestSubmissionTime: lastUpdatedInfo.summaryValue,
    treatmentPathCount: pathTotals.treatment,
    controlPathCount: pathTotals.control,
    unknownPathCount: pathTotals.unknown,
  };

  const quotaProgress = overallTarget > 0 ? Number(((approvedSubmissions / overallTarget) * 100).toFixed(1)) : 0;

  const dashboardData: DashboardData = {
    summary,
    statusBreakdown: {
      approved: approvedSubmissions,
      notApproved: notApprovedSubmissions,
    },
    quotaProgress,
    quotaByLGA,
    quotaByLGAAge,
    quotaByLGAGender,
    mapSubmissions,
    mapMetadata: normalizeMapMetadata(),
    userProductivity: [],
    userProductivityDetailed: [],
    errorBreakdown,
    achievements: {
      byState: achievementsByState,
      byInterviewer: [],
      byLGA: [],
    },
    filters,
    lastUpdated: lastUpdatedInfo.label,
    analysisRows: submissions,
    lgas: filters.lgas,
  };

  return dashboardData;
}
