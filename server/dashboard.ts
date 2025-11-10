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

const getEnvVar = (key: string): string | undefined => {
  return process.env[key] ?? process.env[`VITE_${key}`];
};

export const loadSubmissionRows = async (): Promise<SheetSubmissionRow[]> => {
  const spreadsheetId = getEnvVar("GOOGLE_SHEETS_ID");
  const submissionsSheetName = getEnvVar("GOOGLE_SHEETS_SUBMISSIONS_SHEET");
  const defaultState = getEnvVar("GOOGLE_SHEETS_DEFAULT_STATE");

  if (!spreadsheetId) {
    return sheetSubmissions;
  }

  const submissionRows = await fetchGoogleSheetRows({
    spreadsheetId,
    sheetName: submissionsSheetName ?? undefined,
  });

  return mapSheetRowsToSubmissions(submissionRows, {
    defaultState: defaultState ?? undefined,
  });
};

export const loadDashboardData = async (): Promise<DashboardData> => {
  const spreadsheetId = getEnvVar("GOOGLE_SHEETS_ID");
  const stateTargetsSheetName = getEnvVar("GOOGLE_SHEETS_STATE_TARGETS_SHEET");
  const stateAgeTargetsSheetName = getEnvVar("GOOGLE_SHEETS_STATE_AGE_TARGETS_SHEET");
  const stateGenderTargetsSheetName = getEnvVar("GOOGLE_SHEETS_STATE_GENDER_TARGETS_SHEET");

  const shouldUseGoogleSheets = Boolean(spreadsheetId);

  if (!shouldUseGoogleSheets) {
    return sampleDashboardData;
  }

  const submissions = await loadSubmissionRows();

  if (submissions.length === 0) {
    throw new Error("No submissions found in the configured Google Sheet.");
  }

  const [stateTargetsRows, stateAgeTargetsRows, stateGenderTargetsRows] = await Promise.all([
    stateTargetsSheetName
      ? fetchGoogleSheetRows({
          spreadsheetId: spreadsheetId!,
          sheetName: stateTargetsSheetName,
        })
      : Promise.resolve<null>(null),
    stateAgeTargetsSheetName
      ? fetchGoogleSheetRows({
          spreadsheetId: spreadsheetId!,
          sheetName: stateAgeTargetsSheetName,
        })
      : Promise.resolve<null>(null),
    stateGenderTargetsSheetName
      ? fetchGoogleSheetRows({
          spreadsheetId: spreadsheetId!,
          sheetName: stateGenderTargetsSheetName,
        })
      : Promise.resolve<null>(null),
  ]);

  return buildDashboardData({
    submissions,
    stateTargets: stateTargetsRows ? mapSheetRowsToStateTargets(stateTargetsRows) : undefined,
    stateAgeTargets: stateAgeTargetsRows
      ? mapSheetRowsToStateAgeTargets(stateAgeTargetsRows)
      : undefined,
    stateGenderTargets: stateGenderTargetsRows
      ? mapSheetRowsToStateGenderTargets(stateGenderTargetsRows)
      : undefined,
  });
};
