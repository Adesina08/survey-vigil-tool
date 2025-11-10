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
import {
  sheetSubmissions,
  type SheetSubmissionRow,
  type AgeGroup,
  type Gender,
} from "../src/data/sampleData";

export const loadSubmissionRows = async (): Promise<SheetSubmissionRow[]> => {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const submissionsSheetName = process.env.GOOGLE_SHEETS_SUBMISSIONS_SHEET;
  const defaultState = process.env.GOOGLE_SHEETS_DEFAULT_STATE;

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
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  const shouldUseGoogleSheets = Boolean(spreadsheetId);

  if (!shouldUseGoogleSheets) {
    return sampleDashboardData;
  }

  const submissions = await loadSubmissionRows();

  if (submissions.length === 0) {
    throw new Error("No submissions found in the configured Google Sheet.");
  }

  const stateTargets = [{ State: "Ogun State", "State Target": 2000 }];
  const ageGroups: AgeGroup[] = ["15-25", "26-35", "36-45", "46+"];
  const genders: Gender[] = ["Male", "Female"];
  const stateAgeTargets = ageGroups.map((group) => ({
    State: "Ogun State",
    "Age Group": group,
    "Age Group Target": 2000 / ageGroups.length,
  }));
  const stateGenderTargets = genders.map((gender) => ({
    State: "Ogun State",
    Gender: gender,
    "Gender Target": 2000 / genders.length,
  }));

  return buildDashboardData({
    submissions,
    stateTargets,
    stateAgeTargets,
    stateGenderTargets,
  });
};
