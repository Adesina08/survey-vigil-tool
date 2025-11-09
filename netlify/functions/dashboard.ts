import { loadDashboardData } from "../../server/dashboard";

const jsonResponse = (statusCode: number, payload: unknown) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

export const handler = async () => {
  try {
    const data = await loadDashboardData();
    return jsonResponse(200, data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to load dashboard data:", error);
    return jsonResponse(500, { error: message });
  }
};
