// src/services/googleSheets.ts
import { PILLAR_FIELD_NAME } from "@/constants/pillar";

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const SHEET_NAME = import.meta.env.VITE_GOOGLE_SHEET_NAME ?? "Form Responses 1";

/**
 * Extract JSON payload from Google's gviz response format.
 *
 * Example wrapper:
 *   google.visualization.Query.setResponse({...});
 */
function extractJsonPayload(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unexpected Google Sheets gviz response format");
  }
  const jsonStr = text.slice(start, end + 1);
  return JSON.parse(jsonStr);
}


/**
 * Parse gviz JSON into array of row objects keyed by column labels
 */
function parseGvizJson(text: string): Record<string, unknown>[] {
  const payload = extractJsonPayload(text) as Record<string, unknown>;
  const table = (payload.table ?? {}) as Record<string, unknown>;
  const cols = (table.cols ?? []) as Array<{ label?: string; id?: string }>;
  const rows = (table.rows ?? []) as Array<{ c?: Array<{ v?: unknown }> }>;

  const headers = cols.map((col) => (col.label || col.id || "").toString());

  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    const cells = row.c ?? [];
    headers.forEach((header, idx) => {
      const cell = cells[idx];
      obj[header] = cell?.v ?? "";
    });
    return obj;
  });
}

/**
 * Fetch all rows from the single Google Sheet tab.
 * This is the raw source for all dashboard data.
 */
export async function fetchFromGoogleSheets(): Promise<Record<string, unknown>[]> {
  if (!SHEET_ID) {
    throw new Error("VITE_GOOGLE_SHEET_ID environment variable is not set");
  }

  const url =
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}` +
    `/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet (HTTP ${response.status})`);
  }

  const text = await response.text();
  const rows = parseGvizJson(text);

  console.group("📊 Google Sheets Data Debug");
  console.log("Total rows fetched:", rows.length);

  if (rows.length > 0) {
    const firstRow = rows[0];
    console.log("Column headers found:", Object.keys(firstRow));
    console.log("First row sample:", {
      "A1. Enumerator ID": firstRow["A1. Enumerator ID"],
      "A3. select the LGA": firstRow["A3. select the LGA"],
      [PILLAR_FIELD_NAME]: firstRow[PILLAR_FIELD_NAME],
      Approval: firstRow["Approval"],
      "QC Status": firstRow["QC Status"],
      _id: firstRow["_id"],
      State: firstRow["State"],
    });

    const qcFlagColumns = Object.keys(firstRow).filter(
      (key) => key.startsWith("QC_FLAG") || key.startsWith("QC_WARN"),
    );
    console.log("QC Flag columns found:", qcFlagColumns);

    const approvalValues = rows.slice(0, 5).map((r) => ({
      Approval: r["Approval"],
      "QC Status": r["QC Status"],
      "A6. Consent to participate": r["A6. Consent to participate"],
    }));
    console.log("Sample approval data (first 5 rows):", approvalValues);
  }

  console.groupEnd();

  return rows;
}
