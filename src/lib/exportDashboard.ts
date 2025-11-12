import { formatErrorLabel } from "@/lib/utils";

type SheetJS = typeof import("xlsx");

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

interface DashboardExcelExporter {
  exportAll: () => void;
  exportApproved: () => void;
  exportNotApproved: () => void;
  exportErrorFlags: () => void;
}

const ARRAY_DELIMITER = "; ";

const toSheetValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
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
            console.warn("Failed to serialise array entry for Excel export", error);
            return String(item);
          }
        }

        const flattened = toSheetValue(item);
        return flattened === null ? "" : String(flattened);
      })
      .filter((chunk) => chunk.length > 0)
      .join(ARRAY_DELIMITER);
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.warn("Failed to serialise object for Excel export", error);
      return null;
    }
  }

  return String(value);
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

const sanitizeSheetName = (raw: string): string => {
  const fallback = "Sheet1";
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  const cleaned = raw
    .replace(/[\\/?*:]/g, " ")
    .replace(/\[/g, " ")
    .replace(/\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return fallback;
  }

  return cleaned.slice(0, 31);
};

const loadSheetJS = async (): Promise<SheetJS> => {
  const module = (await import("xlsx")) as SheetJS & { default?: SheetJS };
  return module.default ?? module;
};

const createSheetData = (
  headers: string[],
  rows: DashboardExportRow[],
): Array<Array<string | number | boolean | null>> => {
  const headerRow = headers.map((header) => header ?? "");
  const bodyRows = rows.map((row) =>
    headers.map((header) => toSheetValue((row as Record<string, unknown>)[header])),
  );
  return [headerRow, ...bodyRows];
};

const triggerExcelDownload = async (
  fileName: string,
  sheetName: string,
  headers: string[],
  rows: DashboardExportRow[],
) => {
  if (typeof window === "undefined") {
    console.warn("Excel export is only supported in the browser context.");
    return;
  }

  try {
    const XLSX = await loadSheetJS();
    const workbook = XLSX.utils.book_new();
    const data = createSheetData(headers, rows);
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    const columnWidths = headers.map((header, index) => {
      const headerLength = header?.length ?? 0;
      const maxCellLength = rows.reduce((max, row) => {
        const cellValue = toSheetValue((row as Record<string, unknown>)[headers[index]]);
        const length = cellValue === null ? 0 : String(cellValue).length;
        return Math.max(max, length);
      }, headerLength);
      const width = Math.min(Math.max(maxCellLength + 2, 8), 60);
      return { wch: width };
    });

    worksheet["!cols"] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));
    XLSX.writeFile(workbook, fileName);
  } catch (error) {
    console.error("Failed to export Excel file", error);
  }
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
  `OGSTEP_IMPACT_SURVEY_${label}_${formatCurrentDateLabel()}.xlsx`;

const createSheetLabel = (label: string) =>
  sanitizeSheetName(
    label
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .trim() || "Sheet1",
  );

const prepareRows = (rows: DashboardExportRow[]): DashboardExportRow[] =>
  rows.map(trimRowToIndex);

export const createDashboardExcelExporter = ({
  rows,
  errorBreakdown = [],
}: ExporterOptions): DashboardExcelExporter => {
  const preparedRows = prepareRows(Array.isArray(rows) ? rows : []);
  const baseHeaders = buildHeaderOrder(preparedRows, "_index");

  const download = (label: string, dataset: DashboardExportRow[]) => {
    const trimmed = prepareRows(dataset);
    const headersToUse = baseHeaders.length > 0 ? baseHeaders : buildHeaderOrder(trimmed, "_index");

    if (headersToUse.length === 0) {
      console.warn(`No headers available for ${label} export.`);
      return;
    }

    const fileName = createExportFileName(label);
    const sheetLabel = createSheetLabel(label);

    void triggerExcelDownload(fileName, sheetLabel, headersToUse, trimmed);
  };

  const downloadErrorBreakdown = () => {
    const headers = ["Error Type", "Count", "Percentage"];
    const rowsForExport = (errorBreakdown ?? []).map((row) => ({
      "Error Type": formatErrorLabel(row.errorType),
      Count: row.count,
      Percentage: `${row.percentage.toFixed(1)}%`,
    }));

    const fileName = createExportFileName("Error Flags");
    const sheetLabel = createSheetLabel("Error Flags");

    void triggerExcelDownload(fileName, sheetLabel, headers, rowsForExport);
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

export type { DashboardExcelExporter };
