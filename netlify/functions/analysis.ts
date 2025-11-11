import {
  generateAnalysisSchema,
  generateAnalysisTable,
  type AnalysisSchema,
} from "../../server/analysis";

const jsonResponse = (statusCode: number, payload: unknown) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

export const handler = async (event: { path?: string; queryStringParameters?: Record<string, string> }) => {
  try {
    const path = event.path || "";

    if (path.endsWith("/schema")) {
      const schema = await generateAnalysisSchema();
      return jsonResponse(200, schema);
    }

    if (path.endsWith("/table")) {
      const params = event.queryStringParameters || {};
      const table = await generateAnalysisTable({
        topbreak: params.topbreak ?? null,
        variable: params.variable ?? null,
        stat: params.stat ?? null,
        limitCategories: params.limit_categories ?? null,
      });
      return jsonResponse(200, table);
    }

    return jsonResponse(404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Analysis function error:", error);
    return jsonResponse(500, { error: message });
  }
};
