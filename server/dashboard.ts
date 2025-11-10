import {
  fetchGoogleSheetRows,
  mapSheetRowsToStateAgeTargets,
  mapSheetRowsToStateGenderTargets,
  mapSheetRowsToStateTargets,
  mapSheetRowsToSubmissions,
} from "../src/lib/googleSheets";
import {
  buildDashboardData,
  dashboardData as sampleDashboardData,
  type DashboardData,
} from "../src/lib/dashboardData";
import { sheetSubmissions, type SheetSubmissionRow } from "../src/data/sampleData";

const getEnv = (name: string) =>
  process.env[name] || process.env[`VITE_${name}`] || "";

// ----------- SINGLE-STATE CONFIG -----------
const OGUN_STATE_NAME = "Ogun State";
const OVERALL_STATE_TARGET = 2000;

// Age groups starting from 15
const AGE_GROUPS = ["15-24", "25-34", "35-44", "45+"] as const;
type AgeGroup = (typeof AGE_GROUPS)[number];

const GENDER_GROUPS = ["Male", "Female"] as const;
// -------------------------------------------

function bucketAge(value: unknown): AgeGroup {
  const n = Number(value);
  if (Number.isFinite(n)) {
    if (n >= 15 && n <= 24) return "15-24";
    if (n >= 25 && n <= 34) return "25-34";
    if (n >= 35 && n <= 44) return "35-44";
  }
  return "45+";
}

function normalizeGender(value: unknown): "Male" | "Female" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "male" || raw === "m") return "Male";
  if (raw === "female" || raw === "f") return "Female";
  // default to Female only to keep exactly two buckets and avoid “Unknown”
  return "Female";
}

/**
 * This enriches rows coming from your sheet:
 * - force State = "Ogun State"
 * - map Gender from "A7. Sex"
 * - derive Age Group from "A8. Age"
 * You can extend this if you add more columns later.
 */
function enrichSubmissionRows(rows: SheetSubmissionRow[]): SheetSubmissionRow[] {
  return rows.map((r) => {
    const copy: SheetSubmissionRow = { ...r };

    // Force single-state
    (copy as any).State = OGUN_STATE_NAME;

    // Gender from your exact header
    const rawGender = (r as any)["A7. Sex"];
    (copy as any).Gender = normalizeGender(rawGender);

    // Age group from your exact header
    const rawAge = (r as any)["A8. Age"];
    (copy as any)["Age Group"] = bucketAge(rawAge);

    // LGA from your exact header (dashboard already looks for LGA or A3)
    if (!(copy as any).LGA && (r as any)["A3. select the LGA"]) {
      (copy as any).LGA = String((r as any)["A3. select the LGA"]);
    }

    // GPS (if only lat/long separate)
    if (!(copy as any)["A5. GPS Coordinates"]) {
      const lat = (r as any)["_A5. GPS Coordinates_latitude"];
      const lng = (r as any)["_A5. GPS Coordinates_longitude"];
      if (lat != null && lng != null) {
        (copy as any)["A5. GPS Coordinates"] = `${lat}, ${lng}`;
      }
    }

    return copy;
  });
}

/**
 * When target sheets are not provided, create targets automatically:
 * - State target = 2000
 * - Age targets = state target / number of age groups
 * - Gender targets = state target / 2
 */
function buildFallbackTargets() {
  const perAge = Math.round(OVERALL_STATE_TARGET / AGE_GROUPS.length);
  const perGender = Math.round(OVERALL_STATE_TARGET / GENDER_GROUPS.length);

  const stateTargets = [{ State: OGUN_STATE_NAME, "State Target": OVERALL_STATE_TARGET }];

  const stateAgeTargets = AGE_GROUPS.map((g) => ({
    State: OGUN_STATE_NAME,
    "Age Group": g,
    "Age Group Target": perAge,
  }));

  const stateGenderTargets = GENDER_GROUPS.map((g) => ({
    State: OGUN_STATE_NAME,
    Gender: g,
    "Gender Target": perGender,
  }));

  return { stateTargets, stateAgeTargets, stateGenderTargets };
}

export const loadSubmissionRows = async (): Promise<SheetSubmissionRow[]> => {
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");
  const submissionsSheetName = getEnv("GOOGLE_SHEETS_SUBMISSIONS_SHEET");
  // We will not rely on default_state here; we force "Ogun State" above.

  if (!spreadsheetId) {
    // local fallback sample
    return sheetSubmissions;
  }

  const rawRows = await fetchGoogleSheetRows({
    spreadsheetId,
    sheetName: submissionsSheetName || undefined, // undefined => first tab
  });

  // Normalize headers/values for your sheet
  const enriched = enrichSubmissionRows(
    mapSheetRowsToSubmissions(rawRows, { defaultState: OGUN_STATE_NAME })
  );

  return enriched;
};

export const loadDashboardData = async (): Promise<DashboardData> => {
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");
  if (!spreadsheetId) {
    return sampleDashboardData;
  }

  const submissions = await loadSubmissionRows();

  if (!submissions || submissions.length === 0) {
    throw new Error(
      "No submissions found. Ensure the Google Sheet is public (or 'Published to the web'), the tab name is correct, and that at least one data row exists beneath the header row."
    );
  }

  // Try reading targets from optional tabs; if not present, build fallbacks.
  const stateTargetsSheetName = getEnv("GOOGLE_SHEETS_STATE_TARGETS_SHEET");
  const stateAgeTargetsSheetName = getEnv("GOOGLE_SHEETS_STATE_AGE_TARGETS_SHEET");
  const stateGenderTargetsSheetName = getEnv("GOOGLE_SHEETS_STATE_GENDER_TARGETS_SHEET");

  let stateTargetsRows: any[] | null = null;
  let stateAgeTargetsRows: any[] | null = null;
  let stateGenderTargetsRows: any[] | null = null;

  if (stateTargetsSheetName) {
    stateTargetsRows = await fetchGoogleSheetRows({ spreadsheetId, sheetName: stateTargetsSheetName });
  }
  if (stateAgeTargetsSheetName) {
    stateAgeTargetsRows = await fetchGoogleSheetRows({ spreadsheetId, sheetName: stateAgeTargetsSheetName });
  }
  if (stateGenderTargetsSheetName) {
    stateGenderTargetsRows = await fetchGoogleSheetRows({ spreadsheetId, sheetName: stateGenderTargetsSheetName });
  }

  // If any targets missing, generate sensible fallbacks for a single-state deployment
  const {
    stateTargets: fallbackStateTargets,
    stateAgeTargets: fallbackStateAgeTargets,
    stateGenderTargets: fallbackStateGenderTargets,
  } = buildFallbackTargets();

  return buildDashboardData({
    submissions,
    stateTargets: stateTargetsRows
      ? mapSheetRowsToStateTargets(stateTargetsRows)
      : mapSheetRowsToStateTargets(fallbackStateTargets as any),
    stateAgeTargets: stateAgeTargetsRows
      ? mapSheetRowsToStateAgeTargets(stateAgeTargetsRows)
      : mapSheetRowsToStateAgeTargets(fallbackStateAgeTargets as any),
    stateGenderTargets: stateGenderTargetsRows
      ? mapSheetRowsToStateGenderTargets(stateGenderTargetsRows)
      : mapSheetRowsToStateGenderTargets(fallbackStateGenderTargets as any),
  });
};
