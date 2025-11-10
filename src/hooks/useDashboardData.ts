import { useQuery } from "@tanstack/react-query";

import { DASHBOARD_ENDPOINT } from "@/lib/api.endpoints";
import { dashboardData as sampleDashboardData, type DashboardData } from "@/lib/dashboardData";

type DashboardApiResponse = Partial<DashboardData> & {
  rows?: unknown[];
  summary?: Partial<DashboardData["summary"]> & Record<string, unknown>;
};

const API = DASHBOARD_ENDPOINT;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toRecord = (value: unknown): Record<string, unknown> | undefined =>
  (isRecord(value) ? value : undefined);

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const readNumber = (source: Record<string, unknown> | undefined, keys: string[], fallback: number): number => {
  if (source) {
    for (const key of keys) {
      const candidate = coerceNumber(source[key]);
      if (candidate !== null) {
        return candidate;
      }
    }
  }

  return fallback;
};

const readString = (source: Record<string, unknown> | undefined, keys: string[]): string | null => {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
};

const APPROVED_STATUSES = new Set([
  "approved",
  "valid",
  "1",
  "true",
  "yes",
]);

const REJECTED_STATUSES = new Set([
  "not approved",
  "rejected",
  "invalid",
  "0",
  "false",
  "no",
]);

const STATUS_KEYS = [
  "approvalStatus",
  "approval_status",
  "status",
  "_status",
  "_submission_status",
  "Approval Status",
  "Outcome Status",
];

const TIMESTAMP_KEYS = [
  "latestSubmissionTime",
  "_submission_time",
  "submission_time",
  "timestamp",
  "_submitted_at",
  "_created_at",
  "created_at",
  "lastUpdated",
];

const interpretApprovalStatus = (row: unknown): boolean | null => {
  if (!isRecord(row)) {
    return null;
  }

  for (const key of STATUS_KEYS) {
    const raw = row[key];
    if (raw === undefined || raw === null) {
      continue;
    }

    const normalized = String(raw).trim().toLowerCase();
    if (APPROVED_STATUSES.has(normalized)) {
      return true;
    }

    if (REJECTED_STATUSES.has(normalized)) {
      return false;
    }
  }

  return null;
};

const extractTimestamp = (row: unknown): number | null => {
  if (!isRecord(row)) {
    return null;
  }

  for (const key of TIMESTAMP_KEYS) {
    const value = row[key];
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 1_000_000_000_000 ? value : value * 1000;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const deriveLatestSubmissionTime = (
  summary: Record<string, unknown> | undefined,
  rows: unknown[],
): string | null => {
  const summaryLatest = readString(summary, ["latestSubmissionTime", "lastUpdated"]);
  if (summaryLatest) {
    return summaryLatest;
  }

  const timestamps = rows
    .map((row) => extractTimestamp(row))
    .filter((value): value is number => value !== null);

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
};

const normalizeSummary = (
  summary: DashboardApiResponse["summary"],
  rows: unknown[],
): DashboardData["summary"] => {
  const summaryRecord = toRecord(summary);
  const fallbackSummary = sampleDashboardData.summary;

  const totalCandidate = readNumber(summaryRecord, ["totalSubmissions", "total"], rows.length);
  const totalSubmissions = Math.max(Math.round(totalCandidate), 0);

  const approvedCandidate = readNumber(summaryRecord, ["approvedSubmissions", "approved", "valid"], Number.NaN);
  let derivedApproved = 0;
  let derivedNotApproved = 0;

  if (!Number.isFinite(approvedCandidate)) {
    for (const row of rows) {
      const status = interpretApprovalStatus(row);
      if (status === true) {
        derivedApproved += 1;
      } else if (status === false) {
        derivedNotApproved += 1;
      }
    }
  }

  const approvedSubmissions = Number.isFinite(approvedCandidate)
    ? Math.min(Math.max(Math.round(approvedCandidate), 0), totalSubmissions)
    : Math.min(derivedApproved, totalSubmissions);

  const notApprovedCandidate = readNumber(
    summaryRecord,
    ["notApprovedSubmissions", "rejected", "notApproved"],
    Number.NaN,
  );

  let notApprovedSubmissions = Number.isFinite(notApprovedCandidate)
    ? Math.max(Math.round(notApprovedCandidate), 0)
    : derivedNotApproved > 0
      ? derivedNotApproved
      : Math.max(totalSubmissions - approvedSubmissions, 0);

  notApprovedSubmissions = Math.min(notApprovedSubmissions, totalSubmissions);

  const overallTargetCandidate = readNumber(
    summaryRecord,
    ["overallTarget", "target"],
    totalSubmissions || fallbackSummary.overallTarget,
  );
  const overallTarget = Math.max(Math.round(overallTargetCandidate), totalSubmissions);

  const approvalRateCandidate = readNumber(
    summaryRecord,
    ["approvalRate", "approvedPercentage", "approvedRate"],
    Number.NaN,
  );
  const approvalRate = Number.isFinite(approvalRateCandidate)
    ? Math.max(Math.min(Math.round(approvalRateCandidate), 100), 0)
    : totalSubmissions > 0
      ? Math.round((approvedSubmissions / totalSubmissions) * 100)
      : fallbackSummary.approvalRate;

  const notApprovedRateCandidate = readNumber(
    summaryRecord,
    ["notApprovedRate", "rejectedPercentage", "rejectedRate"],
    Number.NaN,
  );
  const notApprovedRate = Number.isFinite(notApprovedRateCandidate)
    ? Math.max(Math.min(Math.round(notApprovedRateCandidate), 100), 0)
    : totalSubmissions > 0
      ? Math.round((notApprovedSubmissions / totalSubmissions) * 100)
      : fallbackSummary.notApprovedRate;

  const latestSubmissionTime = deriveLatestSubmissionTime(summaryRecord, rows);

  return {
    overallTarget,
    totalSubmissions,
    approvedSubmissions,
    approvalRate,
    notApprovedSubmissions,
    notApprovedRate,
    latestSubmissionTime,
  };
};

export async function fetchDashboard(): Promise<DashboardData> {
  try {
    const response = await fetch(API, { cache: "no-store" });

    if (!response.ok) {
      const text = await response.text();
      console.error("DASHBOARD HTTP ERROR", response.status, text.slice(0, 300));
      throw new Error(`dashboard ${response.status}`);
    }

    const payload = (await response.json()) as unknown;

    if (!payload || typeof payload !== "object") {
      throw new Error("empty dashboard payload");
    }

    const data = payload as DashboardApiResponse;
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const summary = normalizeSummary(data.summary, rows);
    const lastUpdatedCandidate =
      typeof data.lastUpdated === "string" && data.lastUpdated.trim()
        ? data.lastUpdated
        : summary.latestSubmissionTime ?? sampleDashboardData.lastUpdated;

    const normalized: DashboardData = {
      summary,
      statusBreakdown: {
        approved: data.statusBreakdown?.approved ?? 0,
        notApproved: data.statusBreakdown?.notApproved ?? 0,
      },
      quotaProgress: data.quotaProgress ?? 0,
      quotaByLGA: data.quotaByLGA ?? [],
      quotaByLGAAge: data.quotaByLGAAge ?? [],
      quotaByLGAGender: data.quotaByLGAGender ?? [],
      mapSubmissions: data.mapSubmissions ?? [],
      userProductivity: data.userProductivity ?? [],
      errorBreakdown: data.errorBreakdown ?? [],
      achievements: {
        byState: data.achievements?.byState ?? [],
        byInterviewer: data.achievements?.byInterviewer ?? [],
        byLGA: data.achievements?.byLGA ?? [],
      },
      filters: {
        lgas: data.filters?.lgas ?? [],
        interviewers: data.filters?.interviewers ?? [],
        errorTypes: data.filters?.errorTypes ?? [],
      },
      lastUpdated: lastUpdatedCandidate,
      analysisRows: data.analysisRows ?? [],
    };

    console.log("DASHBOARD OK", normalized);
    return normalized;
  } catch (error) {
    console.error("DASHBOARD FETCH ERROR", error);
    throw error instanceof Error ? error : new Error("dashboard fetch failed");
  }
}

export const useDashboardData = () =>
  useQuery<DashboardData, Error>({
    queryKey: ["dashboard-data"],
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
