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

const readTopbreaks = (params: Record<string, string | undefined>): string[] => {
  const candidateKeys = new Set(["topbreak", "topbreaks", "topbreak[]", "topBreak", "topBreaks"]);

  Object.keys(params).forEach((key) => {
    if (/topbreak/i.test(key)) {
      candidateKeys.add(key);
    }
  });

  const rawValues = Array.from(candidateKeys)
    .map((key) => params[key])
    .filter((value): value is string => Boolean(value));

  const splitValues = rawValues.flatMap((value) =>
    value
      .split(",")
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part)),
  );

  return Array.from(new Set(splitValues));
};

export const handler = async (event: { path?: string; queryStringParameters?: Record<string, string> }) => {
  try {
    const path = event.path || "";

    if (path.endsWith("/schema")) {
      const schema = await generateAnalysisSchema();
      return jsonResponse(200, schema);
    }

    if (path.endsWith("/table")) {
      const params = event.queryStringParameters || {};
      const topbreaks = readTopbreaks(params);
      const table = await generateAnalysisTable({
        topbreaks: topbreaks.length > 0 ? topbreaks : null,
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
