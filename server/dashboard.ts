import { fetchGoogleSheetFromUrl, mapSheetRowsToSubmissions } from "../src/lib/googleSheets";
import { buildDashboardData, type DashboardData } from "../src/lib/dashboardData";
import type {
  SheetStateAgeTargetRow,
  SheetStateGenderTargetRow,
  SheetStateTargetRow,
  SheetSubmissionRow,
} from "../src/data/sampleData";

// ----------- SINGLE-STATE CONFIG -----------
const OGUN_STATE_NAME = "Ogun State";
const OVERALL_STATE_TARGET = 2000;

// Age groups starting from 15
const AGE_GROUPS = ["15-24", "25-34", "35-44", "45+"] as const;

const GENDER_GROUPS = ["Male", "Female"] as const;
// -------------------------------------------

const GOOGLE_SHEETS_URL_MISSING_ERROR = "GOOGLE_SHEETS_URL not set";
const GOOGLE_SHEETS_FETCH_ERROR_MESSAGE =
  "Google Sheets URL not reachable or returned no rows. Ensure the sheet is published or publicly viewable.";

const resolveGoogleSheetsUrl = (): string => {
  const envUrl = process.env.GOOGLE_SHEETS_URL || process.env.VITE_GOOGLE_SHEETS_URL || "";
  return envUrl.trim();
};

function bucketAge(value: unknown): SheetSubmissionRow["Age Group"] {
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

  const stateTargets: SheetStateTargetRow[] = [
    { State: OGUN_STATE_NAME, "State Target": OVERALL_STATE_TARGET },
  ];

  const stateAgeTargets: SheetStateAgeTargetRow[] = AGE_GROUPS.map((g) => ({
    State: OGUN_STATE_NAME,
    "Age Group": g,
    "Age Group Target": perAge,
  }));

  const stateGenderTargets: SheetStateGenderTargetRow[] = GENDER_GROUPS.map((g) => ({
    State: OGUN_STATE_NAME,
    Gender: g,
    "Gender Target": perGender,
  }));

  return { stateTargets, stateAgeTargets, stateGenderTargets };
}

export const loadSubmissionRows = async (): Promise<SheetSubmissionRow[]> => {
  const googleSheetsUrl = resolveGoogleSheetsUrl();

  if (!googleSheetsUrl) {
    throw new Error(GOOGLE_SHEETS_URL_MISSING_ERROR);
  }

  let rawRows: Record<string, unknown>[];
  try {
    rawRows = await fetchGoogleSheetFromUrl(googleSheetsUrl);
  } catch (error) {
    console.error("Failed to fetch Google Sheets data:", error);
    throw new Error(GOOGLE_SHEETS_FETCH_ERROR_MESSAGE);
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error(GOOGLE_SHEETS_FETCH_ERROR_MESSAGE);
  }

  const submissions = mapSheetRowsToSubmissions(rawRows, { defaultState: OGUN_STATE_NAME });
  const enriched = enrichSubmissionRows(submissions);

  return enriched;
};

export const loadDashboardData = async (): Promise<DashboardData> => {
  const submissions = await loadSubmissionRows();

  if (!submissions || submissions.length === 0) {
    throw new Error(GOOGLE_SHEETS_FETCH_ERROR_MESSAGE);
  }

  const {
    stateTargets: fallbackStateTargets,
    stateAgeTargets: fallbackStateAgeTargets,
    stateGenderTargets: fallbackStateGenderTargets,
  } = buildFallbackTargets();

  return buildDashboardData({
    submissions,
    stateTargets: fallbackStateTargets,
    stateAgeTargets: fallbackStateAgeTargets,
    stateGenderTargets: fallbackStateGenderTargets,
    analysisRows: submissions,
  });
};
