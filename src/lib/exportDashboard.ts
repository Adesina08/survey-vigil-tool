import { formatErrorLabel } from "@/lib/utils";

export type DashboardExportRow = Record<string, unknown>;

interface ErrorBreakdownRow {
  errorType: string;
  count: number;
  percentage: number;
}

interface ExporterOptions {
  rows: DashboardExportRow[];
  errorBreakdown?: ErrorBreakdownRow[];
}

interface DashboardCsvExporter {
  exportAll: () => void;
  exportApproved: () => void;
  exportNotApproved: () => void;
  exportErrorFlags: () => void;
}

const ARRAY_DELIMITER = "; ";

const serialisePrimitive = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || item === undefined) {
          return "";
        }

        if (typeof item === "object") {
          try {
            return JSON.stringify(item);
          } catch (error) {
            console.warn("Failed to serialise array entry for CSV export", error);
            return String(item);
          }
        }

        return serialisePrimitive(item);
      })
      .filter((chunk) => chunk.length > 0)
      .join(ARRAY_DELIMITER);
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.warn("Failed to serialise object for CSV export", error);
      return "";
    }
  }

  return String(value);
};

const escapeCsvValue = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const buildHeaderOrder = (rows: DashboardExportRow[], stopKey?: string): string[] => {
  const seen = new Set<string>();
  const order: string[] = [];

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    });
  });

  if (stopKey) {
    const stopIndex = order.findIndex((key) => key === stopKey);
    if (stopIndex >= 0) {
      return order.slice(0, stopIndex + 1);
    }
  }

  return order;
};

const buildCsv = (rows: DashboardExportRow[], headers: string[]): string => {
  if (headers.length === 0) {
    return "";
  }

  const lines = [headers.join(",")];

  rows.forEach((row) => {
    const line = headers
      .map((header) => escapeCsvValue(serialisePrimitive((row as Record<string, unknown>)[header])))
      .join(",");
    lines.push(line);
  });

  return lines.join("\n");
};

const triggerCsvDownload = (fileName: string, csv: string) => {
  if (typeof window === "undefined") {
    console.warn("CSV export is only supported in the browser context.");
    return;
  }

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const trimRowToIndex = (row: DashboardExportRow): DashboardExportRow => {
  const output: DashboardExportRow = {};
  for (const [key, value] of Object.entries(row)) {
    output[key] = value;
    if (key === "_index") {
      break;
    }
  }
  return output;
};

const normaliseApproval = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
};

const formatCurrentDateLabel = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createExportFileName = (label: string) =>
  `OGSTEP_IMPACT_SURVEY_${label}_${formatCurrentDateLabel()}.csv`;

const prepareRows = (rows: DashboardExportRow[]): DashboardExportRow[] =>
  rows.map(trimRowToIndex);

export const createDashboardCsvExporter = ({
  rows,
  errorBreakdown = [],
}: ExporterOptions): DashboardCsvExporter => {
  const preparedRows = prepareRows(Array.isArray(rows) ? rows : []);
  const baseHeaders = buildHeaderOrder(preparedRows, "_index");

  const download = (label: string, dataset: DashboardExportRow[]) => {
    const trimmed = prepareRows(dataset);
    const headersToUse = baseHeaders.length > 0 ? baseHeaders : buildHeaderOrder(trimmed, "_index");

    if (headersToUse.length === 0) {
      console.warn(`No headers available for ${label} export.`);
      return;
    }

    const csv = buildCsv(trimmed, headersToUse);
    const fileName = createExportFileName(label);
    triggerCsvDownload(fileName, csv);
  };

  const downloadErrorBreakdown = () => {
    const headers = ["Error Type", "Count", "Percentage"];
    const rowsForExport = (errorBreakdown ?? []).map((row) => ({
      "Error Type": formatErrorLabel(row.errorType),
      Count: row.count,
      Percentage: `${row.percentage.toFixed(1)}%`,
    }));

    const csv = buildCsv(rowsForExport, headers);
    const fileName = createExportFileName("Error Flags");
    triggerCsvDownload(fileName, csv);
  };

  return {
    exportAll: () => download("AllData", rows ?? []),
    exportApproved: () =>
      download(
        "ApprovedData",
        (rows ?? []).filter((row) => normaliseApproval(row["Approval"]) === "approved"),
      ),
    exportNotApproved: () =>
      download(
        "NotApprovedData",
        (rows ?? []).filter((row) => normaliseApproval(row["Approval"]) === "not approved"),
      ),
    exportErrorFlags: downloadErrorBreakdown,
  };
};

export type { DashboardCsvExporter };
