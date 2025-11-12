import { Handler } from "@netlify/functions";
import { loadAppsScriptPayload } from "../../server/dashboard";

// Helper to create JSON responses with size checking
const jsonResponse = (statusCode: number, payload: unknown) => {
  const body = JSON.stringify(payload);
  const MAX_BYTES = 5_500_000; // Netlify limit ~6.29 MB, use 5.5 MB for safety
  if (body.length > MAX_BYTES) {
    console.error("apps-script payload too large:", body.length, "bytes");
    return {
      statusCode: 413, // Payload Too Large
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Apps Script payload too large",
        bytes: body.length,
        hint: "Use ?fields=rows,stateTargets&rowLimit=500 to request specific fields.",
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
    // Get query parameters (e.g., ?fields=rows,stateTargets&rowLimit=500)
    const qs = event.queryStringParameters || {};
    const fields = (qs.fields ?? "").split(",").map((s) => s.trim()).filter(Boolean);

    // Load the raw Apps Script payload
    const payload = await loadAppsScriptPayload();

    // If specific fields are requested, return only those
    if (fields.length > 0) {
      const response: any = {};
      for (const field of fields) {
        if (field in payload) {
          // For rows, limit and trim heavy fields
          if (field === "rows") {
            const rowLimit = Number(qs.rowLimit ?? 1000);
            response[field] = payload[field]
              .slice(0, rowLimit)
              .map(
                ({
                  _id,
                  _uuid,
                  _submission_time,
                  A3_select_the_LGA,
                  A7_Sex,
                  A8_Age,
                  _A5_GPS_Coordinates_latitude,
                  _A5_GPS_Coordinates_longitude,
                  Approval,
                  QC_Issues,
                  username,
                  C5_Monthly_income,
                  E1_Own_or_manage_a_business,
                }) => ({
                  id: _id,
                  uuid: _uuid,
                  submissionTime: _submission_time,
                  lga: A3_select_the_LGA,
                  sex: A7_Sex,
                  age: A8_Age,
                  lat: _A5_GPS_Coordinates_latitude,
                  lng: _A5_GPS_Coordinates_longitude,
                  approval: Approval,
                  qcIssues: QC_Issues,
                  username,
                  monthlyIncome: C5_Monthly_income,
                  ownsBusiness: E1_Own_or_manage_a_business,
                }),
              );
          } else {
            response[field] = payload[field];
          }
        }
      }
      return jsonResponse(200, response);
    }

    // Default: return a small summary
    const summary = {
      rowsCount: payload.rows?.length ?? 0,
      stateTargetsCount: payload.stateTargets?.length ?? 0,
      hasSettings: !!payload.settings,
    };

    return jsonResponse(200, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to proxy Apps Script payload:", error);
    return jsonResponse(500, { error: message });
  }
};
