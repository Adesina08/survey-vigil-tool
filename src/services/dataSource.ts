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
  console.log("🔄 Starting dashboard data fetch...");

  try {
    const submissions = (await fetchAllSurveyRows()) as SheetSubmissionRow[];

    console.group("📦 Building Dashboard Data");
    console.log("Raw submissions count:", submissions.length);

    if (submissions.length > 0) {
      console.log("Sample submission structure:", {
        keys: Object.keys(submissions[0]),
        enumeratorId: submissions[0]["A1. Enumerator ID"],
        lga: submissions[0]["A3. select the LGA"],
        approval: submissions[0]["Approval"],
      });
    }

    const dashboard = buildDashboardData({
      submissions,
    });

    console.log("Dashboard built successfully:", {
      totalSubmissions: dashboard.summary.totalSubmissions,
      approved: dashboard.summary.approvedSubmissions,
      interviewers: dashboard.achievements.byInterviewer.length,
      lgas: dashboard.achievements.byLGA.length,
    });
    console.groupEnd();

    return dashboard;
  } catch (error) {
    console.error("❌ Error building dashboard:", error);
    throw error;
  }
}
