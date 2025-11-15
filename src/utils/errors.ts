import { normaliseErrorType } from "@/lib/errorTypes";

const DELIMITER_REGEX = /[;|,\n]/;

const ERROR_FIELD_CANDIDATES = [
  "Quality Flags",
  "quality_flags",
  "Flagged Issues",
  "flagged_issues",
  "Flags",
  "flags",
  "Issues",
  "issues",
  "Quality Issues",
  "quality_issues",
  "QC Flags",
  "qc_flags",
  "Error Flags",
  "error_flags",
  "Error",
  "error",
];

const NESTED_PATHS: Array<[string, string]> = [
  ["qualityMetadata", "flags"],
  ["qualityMetadata", "issues"],
  ["metadata", "flags"],
  ["metadata", "issues"],
];

const toArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(DELIMITER_REGEX)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0);
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
};

const normaliseErrorCode = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  const [leading] = trimmed.split(/[:-]/);
  const token = (leading ?? "").trim();
  return token || trimmed;
};

const readNestedField = (row: Record<string, unknown>, path: [string, string]) => {
  const [parentKey, childKey] = path;
  const parent = row[parentKey];
  if (!parent || typeof parent !== "object") {
    return undefined;
  }
  return (parent as Record<string, unknown>)[childKey];
};

export const extractErrorCodes = (row: Record<string, unknown>): string[] => {
  const perRow = new Set<string>();

  // Dynamically harvest flag-like columns: QC_FLAG_* and QC_WARN_*
  Object.entries(row).forEach(([key, val]) => {
    if (typeof key === "string" && /^QC_(FLAG|WARN)_/i.test(key)) {
      const num =
        typeof val === "number"
          ? val
          : typeof val === "string"
          ? Number(val)
          : 0;
      if (Number.isFinite(num) && num > 0) {
        perRow.add(normaliseErrorType(key).slug);
      }
    }
  });

  const candidates: unknown[] = [];

  ERROR_FIELD_CANDIDATES.forEach((field) => {
    if (field in row) {
      candidates.push(row[field]);
    }
  });

  NESTED_PATHS.forEach((path) => {
    const nested = readNestedField(row, path);
    if (nested !== undefined) {
      candidates.push(nested);
    }
  });

  candidates
    .flatMap((value) => toArray(value))
    .map((value) => normaliseErrorCode(value))
    .filter((value): value is string => Boolean(value))
    .forEach((code) => perRow.add(normaliseErrorType(code).slug));

  return Array.from(perRow);
};

export function getErrorBreakdown(rows: Record<string, unknown>[]) {
  const counts: Record<string, number> = {};

  rows.forEach((rawRow) => {
    if (!rawRow || typeof rawRow !== "object") {
      return;
    }

    const indicatorCounts = extractQualityIndicatorCounts(
      rawRow as Record<string, unknown>,
    );
    Object.entries(indicatorCounts).forEach(([code, value]) => {
      const normalised = normaliseErrorType(code).slug;
      counts[normalised] = (counts[normalised] ?? 0) + value;
    });

    const codes = extractErrorCodes(rawRow as Record<string, unknown>);
    codes.forEach((code) => {
      const normalised = normaliseErrorType(code).slug;
      counts[normalised] = (counts[normalised] ?? 0) + 1;
    });
  });

  return counts;
}

export const collectQualityIndicatorLabels = (
  row: Record<string, unknown>,
): Record<string, string> => {
  const labels: Record<string, string> = {};

  Object.keys(row).forEach((key) => {
    const trimmedKey = typeof key === "string" ? key.trim() : "";

    if (!trimmedKey) {
      return;
    }

    if (/^QC\s*FLAG\s*COUNT$/i.test(trimmedKey)) {
      return;
    }

    if (!/^QC_(FLAG|WARN)_/i.test(trimmedKey)) {
      return;
    }

    const slug = normaliseErrorType(trimmedKey).slug;
    if (!slug || slug.length === 0) {
      return;
    }

    if (!(slug in labels)) {
      labels[slug] = trimmedKey;
    }
  });

  return labels;
};

export const extractQualityIndicatorCounts = (
  row: Record<string, unknown>,
): Record<string, number> => {
  const counts: Record<string, number> = {};

  Object.entries(row).forEach(([key, value]) => {
    const trimmedKey = key.trim();

    if (/^QC\s*FLAG\s*COUNT$/i.test(trimmedKey)) {
      return;
    }

    if (!/^QC_(FLAG|WARN)_/i.test(key)) {
      return;
    }

    let numericValue: number | null = null;
    if (typeof value === "number") {
      numericValue = value;
    } else if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseFloat(value);
      numericValue = Number.isNaN(parsed) ? null : parsed;
    }

    if (numericValue && Number.isFinite(numericValue) && numericValue > 0) {
      const normalisedKey = key.trim();
      const slug = normaliseErrorType(normalisedKey).slug;
      counts[slug] = (counts[slug] ?? 0) + numericValue;
    }
  });

  return counts;
};
