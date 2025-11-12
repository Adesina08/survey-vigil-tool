import { Handler } from "@netlify/functions";
import { loadDashboardData } from "../../server/dashboard";

// Helper to create JSON responses with size checking
const jsonResponse = (statusCode: number, payload: unknown) => {
  const body = JSON.stringify(payload);
  const MAX_BYTES = 5_500_000; // Netlify limit ~6.29 MB, use 5.5 MB for safety
  if (body.length > MAX_BYTES) {
    console.error("dashboard payload too large:", body.length, "bytes");
    return {
      statusCode: 413, // Payload Too Large
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Dashboard payload too large",
        bytes: body.length,
        hint: "Use ?sections=summary,quota or set mapLimit/prodLimit/analysisLimit.",
      }),
    };
  }
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body,
  };
};

export const handler: Handler = async (event) => {
  try {
    // Get query parameters (e.g., ?sections=summary,quota&mapLimit=5000)
    const qs = event.queryStringParameters || {};
    const sections = (qs.sections ?? "summary,quota").split(",").map((s) => s.trim());

    // Load the full dashboard data
    const data = await loadDashboardData();

    // Build a smaller response based on requested sections
    const response: any = {
      summary: data.summary,
      quotaProgress: data.quotaProgress,
    };

    if (sections.includes("quota")) {
      response.quotaByLGA = data.quotaByLGA;
      response.quotaByLGAAge = data.quotaByLGAAge;
      response.quotaByLGAGender = data.quotaByLGAGender;
    }

    if (sections.includes("map")) {
      // Limit map points and keep only essential fields
      const mapLimit = Number(qs.mapLimit ?? 5000);
      response.mapSubmissions = data.mapSubmissions
        .slice(0, mapLimit)
        .map(({ id, lat, lng, state, lga, status, timestamp, _A5_GPS_Coordinates_latitude, _A5_GPS_Coordinates_longitude, Approval, QC_Issues }) => ({
          id,
          lat: _A5_GPS_Coordinates_latitude ?? lat,
          lng: _A5_GPS_Coordinates_longitude ?? lng,
          state,
          lga,
          status,
          timestamp,
          approval: Approval,
          qcIssues: QC_Issues,
        }));
      response.mapMetadata = data.mapMetadata;
    }

    if (sections.includes("productivity")) {
      // Limit productivity rows and keep key fields
      const prodLimit = Number(qs.prodLimit ?? 1000);
      response.userProductivity = data.userProductivity;
      response.userProductivityDetailed = data.userProductivityDetailed
        .slice(0, prodLimit)
        .map(({ username, _id, _submission_time, A3_select_the_LGA, A7_Sex, A8_Age, Approval, QC_Issues }) => ({
          username,
          submissionId: _id,
          submissionTime: _submission_time,
          lga: A3_select_the_LGA,
          sex: A7_Sex,
          age: A8_Age,
          approval: Approval,
          qcIssues: QC_Issues,
        }));
    }

    if (sections.includes("errors")) {
      response.errorBreakdown = data.errorBreakdown;
    }

    if (sections.includes("achievements")) {
      response.achievements = data.achievements;
    }

    if (sections.includes("filters")) {
      response.filters = data.filters;
    }

    if (sections.includes("analysis")) {
      // Limit analysis rows to avoid huge responses
      const analysisLimit = Number(qs.analysisLimit ?? 1000);
      response.analysisRows = data.analysisRows.slice(0, analysisLimit);
    }

    return jsonResponse(200, response);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Failed to load dashboard data:", e);
    return jsonResponse(500, { error: message });
  }
};
