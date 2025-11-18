// src/services/dataSource.ts
import { fetchFromGoogleSheets } from "./googleSheets";
import { transformGoogleSheetsData } from "@/lib/dataTransformer";
import type { DashboardData } from "@/types/dashboard";

/**
 * Fetch raw survey data from Google Sheets and transform it into the
 * dashboard-friendly structure that powers the UI.
 */
const DEFAULT_INTERVIEW_TARGET = 5000;

export async function fetchDashboardData(): Promise<DashboardData> {
  console.log("🔄 Starting dashboard data fetch...");

  try {
    const rawData = await fetchFromGoogleSheets();

    console.group("📦 Transforming Dashboard Data");
    console.log("Raw rows fetched:", rawData.length);

    if (rawData.length > 0) {
      console.log("Sample row keys:", Object.keys(rawData[0] ?? {}));
    }

    const dashboardData = transformGoogleSheetsData(rawData, DEFAULT_INTERVIEW_TARGET);

    console.groupEnd();

    return dashboardData;
  } catch (error) {
    console.error("❌ Error transforming dashboard data:", error);
    throw error;
  }
}
