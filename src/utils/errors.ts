const splitIssues = (value: string): string[] =>
  value
    .split(/[;|,\n]/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

const normaliseErrorCode = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const [code] = trimmed.split(":");
  return code.trim() || null;
};

const extractErrorCodes = (row: Record<string, unknown>): string[] => {
  const codes = new Set<string>();
  const errorFlags = row["Error Flags"];

  if (Array.isArray(errorFlags)) {
    errorFlags
      .map((entry) => normaliseErrorCode(String(entry)))
      .forEach((code) => {
        if (code) {
          codes.add(code);
        }
      });
  } else if (typeof errorFlags === "string" && errorFlags.trim().length > 0) {
    splitIssues(errorFlags).forEach((chunk) => {
      const code = normaliseErrorCode(chunk);
      if (code) {
        codes.add(code);
      }
    });
  }

  const qcIssues = row["QC Issues"];
  if (typeof qcIssues === "string" && qcIssues.trim().length > 0) {
    splitIssues(qcIssues).forEach((chunk) => {
      const code = normaliseErrorCode(chunk);
      if (code) {
        codes.add(code);
      }
    });
  }

  return Array.from(codes);
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
