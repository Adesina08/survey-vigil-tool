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
    const fields = (qs.fields ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Load the raw Apps Script payload (full object from Apps Script)
    const payload = await loadAppsScriptPayload();

    // If specific fields are requested, return only those
    if (fields.length > 0) {
      const response: any = {};

      for (const field of fields) {
        if (field in payload) {
          // For rows, just limit the count – DO NOT remap keys
          if (field === "rows") {
            const rowLimit = Number(qs.rowLimit ?? 1000);
            const rows = Array.isArray(payload[field])
              ? (payload[field] as unknown[])
              : [];
            // Pass through the raw rows from Apps Script, just limiting the count
            response[field] = rows.slice(0, rowLimit);
          } else {
            response[field] = (payload as any)[field];
          }
        }
      }

      return jsonResponse(200, response);
    }

    // Default: return a small summary if no fields were requested
    const summary = {
      rowsCount: (payload as any).rows?.length ?? 0,
      stateTargetsCount: (payload as any).stateTargets?.length ?? 0,
      hasSettings: !!(payload as any).settings,
    };

    return jsonResponse(200, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to proxy Apps Script payload:", error);
    return jsonResponse(500, { error: message });
  }
};
