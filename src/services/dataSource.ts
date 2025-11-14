// src/services/dataSource.ts
import { fetchAllSurveyRows } from "./googleSheets";
import type { DashboardData } from "@/lib/dashboardData";

type RawRow = Record<string, unknown>;

const DEFAULT_STATE = "Ogun State";

// ========== Helper functions ==========
const asNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const asString = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

/**
 * Normalizers for sheet columns (handle case variations)
 */
const getLga = (row: RawRow): string =>
  asString(
    row["A3. select the LGA"] ??
      row["A3. Select the LGA"] ??
      row["A3. select the lga"] ??
      row["a3_select_the_lga"]
  ).trim();

const getState = (row: RawRow): string =>
  asString(row["State"] ?? DEFAULT_STATE).trim();

const getApproval = (row: RawRow): string =>
  asString(row["Approval"]).trim();

const getSex = (row: RawRow): string =>
  asString(row["A7. Sex"]).trim();

const getAge = (row: RawRow): number =>
  asNumber(row["A8. Age"]);

const getLat = (row: RawRow): number =>
  asNumber(row["_A5. GPS Coordinates_latitude"]);

const getLng = (row: RawRow): number =>
  asNumber(row["_A5. GPS Coordinates_longitude"]);

const getInterviewerId = (row: RawRow): string =>
  asString(
    row["A1. Enumerator ID"] ??
      row["interviewer_id"] ??
      row["Interviewer ID"]
  ).trim();

const getInterviewerName = (row: RawRow): string =>
  asString(
    row["Interviewer number"] ??
      row["interviewer_name"] ??
      row["Interviewer Name"]
  ).trim();

// ========== Quota builders ==========
const buildQuotaByLGA = (rows: RawRow[]) => {
  const map = new Map<
    string,
    { state: string; lga: string; target: number; achieved: number }
  >();

  for (const row of rows) {
    const lga = getLga(row);
    const state = getState(row);
    if (!lga) continue;

    if (!map.has(lga)) {
      map.set(lga, { state, lga, target: 0, achieved: 0 });
    }
    const entry = map.get(lga)!;

    if (getApproval(row).toLowerCase() === "approved") {
      entry.achieved += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.lga.localeCompare(b.lga)
  );
};

const buildQuotaByLGAGender = (rows: RawRow[]) => {
  const map = new Map<
    string,
    {
      state: string;
      lga: string;
      gender: string;
      target: number;
      achieved: number;
    }
  >();

  for (const row of rows) {
    const lga = getLga(row);
    const state = getState(row);
    const gender = getSex(row);
    if (!lga || !gender) continue;

    const key = `${lga}||${gender}`;
    if (!map.has(key)) {
      map.set(key, { state, lga, gender, target: 0, achieved: 0 });
    }
    const entry = map.get(key)!;

    if (getApproval(row).toLowerCase() === "approved") {
      entry.achieved += 1;
    }
  }

  return Array.from(map.values());
};

const buildQuotaByLGAAge = (rows: RawRow[]) => {
  const ageBand = (age: number): string => {
    if (!Number.isFinite(age)) return "Unknown";
    if (age < 18) return "<18";
    if (age <= 24) return "18–24";
    if (age <= 35) return "25–35";
    if (age <= 49) return "36–49";
    return "50+";
  };

  const map = new Map<
    string,
    {
      state: string;
      lga: string;
      ageGroup: string;
      target: number;
      achieved: number;
    }
  >();

  for (const row of rows) {
    const lga = getLga(row);
    const state = getState(row);
    if (!lga) continue;

    const band = ageBand(getAge(row));
    const key = `${lga}||${band}`;
    if (!map.has(key)) {
      map.set(key, { state, lga, ageGroup: band, target: 0, achieved: 0 });
    }
    const entry = map.get(key)!;

    if (getApproval(row).toLowerCase() === "approved") {
      entry.achieved += 1;
    }
  }

  return Array.from(map.values());
};

// ========== Map submissions ==========
const buildMapSubmissions = (
  rows: RawRow[]
): DashboardData["mapSubmissions"] =>
  rows
    .map((row) => {
      const lat = getLat(row);
      const lng = getLng(row);
      if (!lat || !lng) return null;

      return {
        id: asString(row["_uuid"] ?? row["_id"] ?? ""),
        latitude: lat,
        longitude: lng,
        lga: getLga(row),
        state: getState(row),
        approval: getApproval(row),
        qcStatus: asString(row["QC Status"]),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

// ========== Error types ==========
const inferErrorTypes = (rows: RawRow[]): string[] => {
  const set = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!key.startsWith("QC_FLAG_") && !key.startsWith("QC_WARN_")) continue;
      if (asNumber(row[key]) > 0) {
        set.add(key);
      }
    }
  }
  return Array.from(set).sort();
};

// ========== Summary ==========
const buildSummary = (
  rows: RawRow[],
  quotaByLGA: { lga: string; target: number; achieved: number }[]
): DashboardData["summary"] => {
  const totalSubmissions = rows.length;
  let approved = 0;
  let notApproved = 0;

  for (const row of rows) {
    const approval = getApproval(row).toLowerCase();
    if (approval === "approved") approved += 1;
    else notApproved += 1;
  }

  const overallTarget = quotaByLGA.reduce(
    (sum, row) => sum + (row.target || 0),
    0
  );

  const approvalRate =
    totalSubmissions > 0
      ? Number(((approved / totalSubmissions) * 100).toFixed(1))
      : 0;

  const notApprovedRate =
    totalSubmissions > 0
      ? Number(((notApproved / totalSubmissions) * 100).toFixed(1))
      : 0;

  return {
    overallTarget,
    totalSubmissions,
    approvedSubmissions: approved,
    approvalRate,
    notApprovedSubmissions: notApproved,
    notApprovedRate,
    completionRate: 0, // QC page will recompute
    treatmentPathCount: 0,
    controlPathCount: 0,
    unknownPathCount: 0,
  };
};

// ========== Achievements ==========
const buildAchievementsByState = (
  rows: RawRow[]
): Array<{ state: string; total: number; approved: number; notApproved: number }> => {
  const map = new Map<
    string,
    { state: string; total: number; approved: number; notApproved: number }
  >();

  for (const row of rows) {
    const state = getState(row);
    const approval = getApproval(row).toLowerCase();

    if (!map.has(state)) {
      map.set(state, { state, total: 0, approved: 0, notApproved: 0 });
    }
    const entry = map.get(state)!;

    entry.total += 1;
    if (approval === "approved") entry.approved += 1;
    else entry.notApproved += 1;
  }

  return Array.from(map.values());
};

const buildAchievementsByInterviewer = (
  rows: RawRow[]
): Array<{
  interviewerId: string;
  interviewerName: string;
  total: number;
  approved: number;
  notApproved: number;
}> => {
  const map = new Map<
    string,
    {
      interviewerId: string;
      interviewerName: string;
      total: number;
      approved: number;
      notApproved: number;
    }
  >();

  for (const row of rows) {
    const interviewerId = getInterviewerId(row) || "Unknown";
    const interviewerName = getInterviewerName(row) || "Unknown";
    const approval = getApproval(row).toLowerCase();

    const key = interviewerId;
    if (!map.has(key)) {
      map.set(key, {
        interviewerId,
        interviewerName,
        total: 0,
        approved: 0,
        notApproved: 0,
      });
    }
    const entry = map.get(key)!;

    entry.total += 1;
    if (approval === "approved") entry.approved += 1;
    else entry.notApproved += 1;
  }

  return Array.from(map.values()).filter(
    (row) => row.interviewerId.toLowerCase() !== "unknown"
  );
};

const buildAchievementsByLGA = (
  rows: RawRow[]
): Array<{
  lga: string;
  total: number;
  approved: number;
  notApproved: number;
}> => {
  const map = new Map<
    string,
    {
      lga: string;
      total: number;
      approved: number;
      notApproved: number;
    }
  >();

  for (const row of rows) {
    const lga = getLga(row);
    const approval = getApproval(row).toLowerCase();
    if (!lga) continue;

    if (!map.has(lga)) {
      map.set(lga, {
        lga,
        total: 0,
        approved: 0,
        notApproved: 0,
      });
    }
    const entry = map.get(lga)!;

    entry.total += 1;
    if (approval === "approved") entry.approved += 1;
    else entry.notApproved += 1;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.lga.localeCompare(b.lga)
  );
};

// ========== Main export ==========
/**
 * Fetch and build complete DashboardData from the single Google Sheet.
 * This replaces the old Apps Script / Netlify proxy approach.
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  const submissions = (await fetchAllSurveyRows()) as RawRow[];

  const quotaByLGA = buildQuotaByLGA(submissions);
  const quotaByLGAAge = buildQuotaByLGAAge(submissions);
  const quotaByLGAGender = buildQuotaByLGAGender(submissions);
  const mapSubmissions = buildMapSubmissions(submissions);
  const summary = buildSummary(submissions, quotaByLGA);
  const errorTypes = inferErrorTypes(submissions);

  const achievementsByState = buildAchievementsByState(submissions);
  const achievementsByInterviewer = buildAchievementsByInterviewer(submissions);
  const achievementsByLGA = buildAchievementsByLGA(submissions);

  const lgas = Array.from(
    new Set(
      submissions
        .map((row) => getLga(row))
        .filter((lga) => lga && lga.length > 0)
    )
  ).sort();

  const dashboardData: DashboardData = {
    submissions,
    mapSubmissions,
    quotaByLGA,
    quotaByLGAAge,
    quotaByLGAGender,
    summary,
    lgas,
    filters: {
      errorTypes,
    },
    achievements: {
      byState: achievementsByState,
      byInterviewer: achievementsByInterviewer,
      byLGA: achievementsByLGA,
    },
    // Safe defaults for fields that may be expected by other components
    stateTargets: [],
    stateAgeTargets: [],
    stateGenderTargets: [],
    settings: {},
    mapMetadata: {},
  };

  return dashboardData;
}
