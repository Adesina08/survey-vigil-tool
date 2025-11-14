// src/services/dataSource.ts
import { fetchAllSurveyRows } from "./googleSheets";
import { buildDashboardData, type DashboardData } from "@/lib/dashboardData";
import type { SheetSubmissionRow } from "@/types/sheets";

/**
 * Fetch and build complete DashboardData from the Google Sheet.
 * Uses the shared builder so all fields expected by the UI
 * (summary, analysisRows, errorBreakdown, achievements, filters, etc.)
 * are populated consistently.
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  // googleSheets.ts returns rows keyed by the sheet column labels,
  // which matches the SheetSubmissionRow shape well enough at runtime.
  const submissions = (await fetchAllSurveyRows()) as SheetSubmissionRow[];

  return buildDashboardData({
    submissions,
    // If in future you fetch extra sheets / metadata,
    // you can pass them into the builder here:
    // stateTargets,
    // stateAgeTargets,
    // stateGenderTargets,
    // analysisRows,
    // mapMetadata,
  });
}
