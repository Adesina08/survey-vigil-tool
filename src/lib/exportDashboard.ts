import { extractErrorCodes } from "@/utils/errors";

export type DashboardExportRow = Record<string, unknown>;

interface ExporterOptions {
  rows: DashboardExportRow[];
  filenamePrefix?: string;
}

interface AnnotatedRow {
  source: DashboardExportRow;
  parsedFlags: string[];
  exportRow: DashboardExportRow;
}

interface DashboardCsvExporter {
  exportAll: () => void;
  exportApproved: () => void;
  exportNotApproved: () => void;
  exportErrorFlags: () => void;
}

const VALUE_DELIMITER = "; ";
const PARSED_FLAGS_HEADER = "Parsed Flags";

const formatTimestamp = () => {
  const iso = new Date().toISOString();
  return iso.replace(/[-:]/g, "").split(".")[0];
};

const createFileName = (prefix: string, label: string) => `${prefix}-${label}-${formatTimestamp()}.csv`;

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
      .join(VALUE_DELIMITER);
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

const buildHeaderOrder = (rows: DashboardExportRow[], extraHeaders: string[]): string[] => {
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

  extraHeaders.forEach((header) => {
    if (!seen.has(header)) {
      seen.add(header);
      order.push(header);
    }
  });

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

const normaliseStatus = (value: unknown): "approved" | "not_approved" | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("invalid")) {
    return "not_approved";
  }

  if (trimmed.includes("not") && trimmed.includes("approv")) {
    return "not_approved";
  }

  if (trimmed.includes("reject")) {
    return "not_approved";
  }

  if (trimmed.includes("approv")) {
    return "approved";
  }

  if (trimmed.includes("valid")) {
    return "approved";
  }

  if (trimmed.includes("pass")) {
    return "approved";
  }

  return null;
};

const resolveStatus = (row: DashboardExportRow): "approved" | "not_approved" | null => {
  const fields = [
    row["Approval Status"],
    row["approval_status"],
    row["Outcome Status"],
    row["outcome_status"],
    row["Status"],
    row["status"],
  ];

  for (const field of fields) {
    const resolved = normaliseStatus(field);
    if (resolved) {
      return resolved;
    }
  }

  return null;
};

const annotateRows = (rows: DashboardExportRow[]): AnnotatedRow[] =>
  rows.map((row) => {
    const parsedFlags = extractErrorCodes(row);
    const exportRow: DashboardExportRow = {
      ...row,
      [PARSED_FLAGS_HEADER]: parsedFlags.join(VALUE_DELIMITER),
    };

    return {
      source: row,
      parsedFlags,
      exportRow,
    };
  });

export const createDashboardCsvExporter = ({
  rows,
  filenamePrefix = "ogstep-dashboard",
}: ExporterOptions): DashboardCsvExporter => {
  const annotated = annotateRows(rows ?? []);
  const exportRows = annotated.map((item) => item.exportRow);
  const headers = buildHeaderOrder(exportRows, [PARSED_FLAGS_HEADER]);

  const download = (label: string, selectedRows: AnnotatedRow[]) => {
    const payload = selectedRows.map((item) => item.exportRow);
    const csv = buildCsv(payload, headers);
    const fileName = createFileName(filenamePrefix, label);
    triggerCsvDownload(fileName, csv);
  };

  return {
    exportAll: () => download("all-data", annotated),
    exportApproved: () =>
      download(
        "approved",
        annotated.filter((item) => resolveStatus(item.source) === "approved"),
      ),
    exportNotApproved: () =>
      download(
        "not-approved",
        annotated.filter((item) => resolveStatus(item.source) === "not_approved"),
      ),
    exportErrorFlags: () =>
      download(
        "error-flags",
        annotated.filter((item) => item.parsedFlags.length > 0),
      ),
  };
};

export type { DashboardCsvExporter };
