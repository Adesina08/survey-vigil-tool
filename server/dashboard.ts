import {
  mapSheetRowsToStateAgeTargets,
  mapSheetRowsToStateGenderTargets,
  mapSheetRowsToStateTargets,
  mapSheetRowsToSubmissions,
} from "../src/lib/googleSheets";
import { buildDashboardData, type DashboardData } from "../src/lib/dashboardData";
import type {
  SheetStateAgeTargetRow,
  SheetStateGenderTargetRow,
  SheetStateTargetRow,
  SheetSubmissionRow,
} from "../src/data/sampleData";

const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || "";

const APPS_SCRIPT_URL_MISSING_ERROR = "APPS_SCRIPT_URL is not set";
const APPS_SCRIPT_FETCH_ERROR_MESSAGE =
  "Apps Script URL not reachable or returned no rows. Ensure the Apps Script Web App is deployed and publicly accessible.";

const OGUN_STATE_NAME = "Ogun State";
const OVERALL_STATE_TARGET = 2000;
const AGE_GROUPS = ["15-24", "25-34", "35-44", "45+"] as const;

const BODY_SNIPPET_LENGTH = 200;

type PresentGender = "Male" | "Female";

interface AppsScriptPayload {
  rows: Record<string, unknown>[];
  stateTargets: Record<string, unknown>[];
  stateAgeTargets: Record<string, unknown>[];
  stateGenderTargets: Record<string, unknown>[];
}

const toRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

export async function fetchFromAppsScript(url: string): Promise<AppsScriptPayload> {
  if (!url) {
    throw new Error(APPS_SCRIPT_URL_MISSING_ERROR);
  }

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    console.error("Failed to reach Apps Script URL:", error);
    throw new Error("Apps Script fetch failed: network error");
  }

  const statusLine = `${response.status} ${response.statusText}`.trim();
  const bodyText = await response.text();

  if (!response.ok) {
    console.error(
      `Apps Script fetch failed: ${statusLine}`,
      bodyText.slice(0, BODY_SNIPPET_LENGTH)
    );
    throw new Error(`Apps Script fetch failed: ${statusLine}`);
  }

  let parsed: unknown;
  try {
    parsed = bodyText.length ? JSON.parse(bodyText) : {};
  } catch (error) {
    console.error(
      "Apps Script response was not valid JSON:",
      bodyText.slice(0, BODY_SNIPPET_LENGTH),
      error
    );
    throw new Error("Apps Script response was not valid JSON");
  }

  const base = Array.isArray(parsed)
    ? {
        rows: parsed,
        stateTargets: [],
        stateAgeTargets: [],
        stateGenderTargets: [],
      }
    : {
        rows:
          (parsed as Record<string, unknown>).rows ??
          (parsed as Record<string, unknown>).data ??
          [],
        stateTargets: (parsed as Record<string, unknown>).stateTargets ?? [],
        stateAgeTargets: (parsed as Record<string, unknown>).stateAgeTargets ?? [],
        stateGenderTargets:
          (parsed as Record<string, unknown>).stateGenderTargets ?? [],
      };

  if (!Array.isArray(base.rows)) {
    console.error("Apps Script response missing rows array:", base.rows);
    throw new Error("Apps Script response must include an array of rows");
  }

  return {
    rows: toRecordArray(base.rows),
    stateTargets: toRecordArray(base.stateTargets),
    stateAgeTargets: toRecordArray(base.stateAgeTargets),
    stateGenderTargets: toRecordArray(base.stateGenderTargets),
  };
}

const collectPresentGenders = (rows: SheetSubmissionRow[]): PresentGender[] => {
  const genders = new Set<PresentGender>();
  rows.forEach((row) => {
    if (row.Gender === "Male" || row.Gender === "Female") {
      genders.add(row.Gender);
    }
  });
  return Array.from(genders);
};

const buildFallbackTargets = (presentGenders: PresentGender[]) => {
  const stateTargets: SheetStateTargetRow[] = [
    { State: OGUN_STATE_NAME, "State Target": OVERALL_STATE_TARGET },
  ];

  const perAge = Math.round(OVERALL_STATE_TARGET / AGE_GROUPS.length);
  const stateAgeTargets: SheetStateAgeTargetRow[] = AGE_GROUPS.map((group) => ({
    State: OGUN_STATE_NAME,
    "Age Group": group,
    "Age Group Target": perAge,
  }));

  const genderDenominator = Math.max(1, presentGenders.length);
  const perGender = Math.round(OVERALL_STATE_TARGET / genderDenominator);
  const stateGenderTargets: SheetStateGenderTargetRow[] = presentGenders.map((gender) => ({
    State: OGUN_STATE_NAME,
    Gender: gender,
    "Gender Target": perGender,
  }));

  return { stateTargets, stateAgeTargets, stateGenderTargets };
};

interface ProvidedTargets {
  stateTargets: SheetStateTargetRow[];
  stateAgeTargets: SheetStateAgeTargetRow[];
  stateGenderTargets: SheetStateGenderTargetRow[];
}

const ensureTargets = (
  submissions: SheetSubmissionRow[],
  provided: ProvidedTargets
): ProvidedTargets => {
  const presentGenders = collectPresentGenders(submissions);
  const fallback = buildFallbackTargets(presentGenders);

  return {
    stateTargets:
      provided.stateTargets.length > 0 ? provided.stateTargets : fallback.stateTargets,
    stateAgeTargets:
      provided.stateAgeTargets.length > 0
        ? provided.stateAgeTargets
        : fallback.stateAgeTargets,
    stateGenderTargets:
      provided.stateGenderTargets.length > 0
        ? provided.stateGenderTargets
        : fallback.stateGenderTargets,
  };
};

export const loadAppsScriptPayload = async () => fetchFromAppsScript(APPS_SCRIPT_URL);

export const loadDashboardData = async (): Promise<DashboardData> => {
  const payload = await loadAppsScriptPayload();

  const submissions = mapSheetRowsToSubmissions(payload.rows, {
    defaultState: OGUN_STATE_NAME,
  });

  if (!submissions || submissions.length === 0) {
    throw new Error(APPS_SCRIPT_FETCH_ERROR_MESSAGE);
  }

  const stateTargets = payload.stateTargets.length
    ? mapSheetRowsToStateTargets(payload.stateTargets)
    : [];
  const stateAgeTargets = payload.stateAgeTargets.length
    ? mapSheetRowsToStateAgeTargets(payload.stateAgeTargets)
    : [];
  const stateGenderTargets = payload.stateGenderTargets.length
    ? mapSheetRowsToStateGenderTargets(payload.stateGenderTargets)
    : [];

  const ensured = ensureTargets(submissions, {
    stateTargets,
    stateAgeTargets,
    stateGenderTargets,
  });

  return buildDashboardData({
    submissions,
    stateTargets: ensured.stateTargets,
    stateAgeTargets: ensured.stateAgeTargets,
    stateGenderTargets: ensured.stateGenderTargets,
    analysisRows: submissions,
  });
};
