// src/services/googleSheets.ts

const rawSheetId = import.meta.env.VITE_GOOGLE_SHEET_ID;
const rawSheetName = import.meta.env.VITE_GOOGLE_SHEET_NAME;

const SHEET_ID = typeof rawSheetId === "string" ? rawSheetId.trim() : "";
const SHEET_NAME =
  typeof rawSheetName === "string" && rawSheetName.trim().length > 0
    ? rawSheetName.trim()
    : "Form Responses 1";

interface GvizColumn {
  label?: string | null;
  id?: string | null;
}

interface GvizCell {
  v?: unknown;
}

interface GvizRow {
  c?: GvizCell[] | null;
}

interface GvizTable {
  cols?: GvizColumn[] | null;
  rows?: GvizRow[] | null;
}

interface GvizResponse {
  table?: GvizTable | null;
}

const extractJsonPayload = (text: string): string => {
  const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?/s);
  if (match && typeof match[1] === "string" && match[1].trim().length > 0) {
    return match[1];
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Unexpected Google Sheets response format");
  }

  return text.slice(firstBrace, lastBrace + 1);
};

const normaliseHeader = (column: GvizColumn | undefined, index: number): string => {
  const label = column?.label ?? column?.id ?? "";
  const trimmed = typeof label === "string" ? label.trim() : "";
  return trimmed.length > 0 ? trimmed : `column_${index}`;
};

const parseGvizJson = (text: string): Record<string, unknown>[] => {
  const payloadText = extractJsonPayload(text);
  const payload = JSON.parse(payloadText) as GvizResponse;
  const table = payload.table ?? {};

  const columns = Array.isArray(table.cols) ? table.cols : [];
  const headers = columns.map((column, index) => normaliseHeader(column ?? undefined, index));

  const rows = Array.isArray(table.rows) ? table.rows : [];

  return rows.map((row) => {
    const cells = Array.isArray(row.c) ? row.c : [];
    const record: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      const cell = cells[index];
      record[header] = cell?.v ?? "";
    });

    return record;
  });
};

export async function fetchAllSurveyRows(): Promise<Record<string, unknown>[]> {
  if (!SHEET_ID) {
    throw new Error(
      "Required environment variable VITE_GOOGLE_SHEET_ID is not set. See the README's troubleshooting section for details.",
    );
  }

  const url =
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_ID)}` +
    `/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new Error(
        `Failed to fetch Google Sheet data due to a client-side error (HTTP ${response.status}). Please check that the VITE_GOOGLE_SHEET_ID and VITE_GOOGLE_SHEET_NAME in your .env file are correct and that the sheet is publicly accessible.`,
      );
    }

    throw new Error(
      `Failed to fetch Google Sheet data due to a server-side error (HTTP ${response.status}). Please try again later.`,
    );
  }

  const text = await response.text();
  return parseGvizJson(text);
}

export type { GvizResponse };
