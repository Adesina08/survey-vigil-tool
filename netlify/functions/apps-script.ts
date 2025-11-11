import { loadAppsScriptPayload } from "../../server/dashboard";

const jsonResponse = (statusCode: number, payload: unknown) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

export const handler = async () => {
  try {
    const payload = await loadAppsScriptPayload();
    return jsonResponse(200, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to proxy Apps Script payload:", error);
    return jsonResponse(500, { error: message });
  }
};
