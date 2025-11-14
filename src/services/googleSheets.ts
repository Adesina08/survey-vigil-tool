const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const SHEET_NAME = import.meta.env.VITE_GOOGLE_SHEET_NAME ?? "Form Responses 1";

function extractJsonPayload(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unexpected Google Sheets response format");
  }
  const jsonStr = text.slice(start, end + 1);
  return JSON.parse(jsonStr) as unknown;
}

function parseGvizJson(text: string): Record<string, unknown>[] {
  const payload = extractJsonPayload(text) as Record<string, unknown>;
  const table = (payload.table ?? {}) as Record<string, unknown>;
  const cols = ((table.cols as Array<Record<string, unknown>> | undefined) ?? []).map(
    (col) => (col.label as string | undefined) ?? (col.id as string | undefined) ?? ""
  );
  const rows = (table.rows as Array<Record<string, unknown>> | undefined) ?? [];

  return rows.map((row) => {
    const cells = (row.c as Array<Record<string, unknown> | null> | undefined) ?? [];
    const entry: Record<string, unknown> = {};
    cells.forEach((cell, index) => {
      const header = cols[index] ?? `Column ${index + 1}`;
      entry[header] = cell?.v ?? "";
    });
    return entry;
  });
}

export async function fetchAllSurveyRows(): Promise<Record<string, unknown>[]> {
  if (!SHEET_ID) {
    throw new Error("VITE_GOOGLE_SHEET_ID is not set");
  }

  const url =
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}` +
    `/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet (HTTP ${response.status})`);
  }

  const text = await response.text();
  return parseGvizJson(text);
}

