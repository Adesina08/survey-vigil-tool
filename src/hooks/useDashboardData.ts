import { useQuery } from "@tanstack/react-query";

import {
  buildDashboardData,
  dashboardData as sampleDashboardData,
  type DashboardData,
} from "@/lib/dashboardData";
import {
  fetchGoogleSheetRows,
  mapSheetRowsToStateAgeTargets,
  mapSheetRowsToStateGenderTargets,
  mapSheetRowsToStateTargets,
  mapSheetRowsToSubmissions,
} from "@/lib/googleSheets";

const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_ID as string | undefined;
const submissionsSheetName = import.meta.env.VITE_GOOGLE_SHEETS_SUBMISSIONS_SHEET as
  | string
  | undefined;
const stateTargetsSheetName = import.meta.env.VITE_GOOGLE_SHEETS_STATE_TARGETS_SHEET as
  | string
  | undefined;
const stateAgeTargetsSheetName = import.meta.env.VITE_GOOGLE_SHEETS_STATE_AGE_TARGETS_SHEET as
  | string
  | undefined;
const stateGenderTargetsSheetName = import.meta.env.VITE_GOOGLE_SHEETS_STATE_GENDER_TARGETS_SHEET as
  | string
  | undefined;
const defaultState = import.meta.env.VITE_GOOGLE_SHEETS_DEFAULT_STATE as string | undefined;

const shouldUseGoogleSheets = Boolean(spreadsheetId && submissionsSheetName);

export const useDashboardData = () => {
  return useQuery<DashboardData, Error>({
    queryKey: [
      "dashboard-data",
      spreadsheetId,
      submissionsSheetName,
      stateTargetsSheetName,
      stateAgeTargetsSheetName,
      stateGenderTargetsSheetName,
      defaultState,
    ],
    queryFn: async () => {
      if (!shouldUseGoogleSheets) {
        return sampleDashboardData;
      }

      const submissionRows = await fetchGoogleSheetRows({
        spreadsheetId: spreadsheetId!,
        sheetName: submissionsSheetName!,
      });

      const submissions = mapSheetRowsToSubmissions(submissionRows, {
        defaultState,
      });

      if (submissions.length === 0) {
        throw new Error("No submissions found in the configured Google Sheet.");
      }

      const [stateTargetsRows, stateAgeTargetsRows, stateGenderTargetsRows] = await Promise.all([
        stateTargetsSheetName
          ? fetchGoogleSheetRows({ spreadsheetId: spreadsheetId!, sheetName: stateTargetsSheetName })
          : Promise.resolve<null>(null),
        stateAgeTargetsSheetName
          ? fetchGoogleSheetRows({ spreadsheetId: spreadsheetId!, sheetName: stateAgeTargetsSheetName })
          : Promise.resolve<null>(null),
        stateGenderTargetsSheetName
          ? fetchGoogleSheetRows({ spreadsheetId: spreadsheetId!, sheetName: stateGenderTargetsSheetName })
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
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: shouldUseGoogleSheets ? 1 : false,
    ...(shouldUseGoogleSheets
      ? {}
      : {
          initialData: sampleDashboardData,
        }),
  });
};
