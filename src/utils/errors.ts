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
    .forEach((code) => perRow.add(code));

  return Array.from(perRow);
};

export function getErrorBreakdown(rows: Record<string, unknown>[]) {
  const counts: Record<string, number> = {};

  rows.forEach((rawRow) => {
    if (!rawRow || typeof rawRow !== "object") {
      return;
    }

    const codes = extractErrorCodes(rawRow as Record<string, unknown>);
    codes.forEach((code) => {
      counts[code] = (counts[code] ?? 0) + 1;
    });
  });

  return counts;
}
