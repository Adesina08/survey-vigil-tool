export type NormalisedApprovalStatus = "Approved" | "Not Approved";

const truthyTokens = new Set([
  "approved",
  "valid",
  "pass",
  "passed",
  "true",
  "yes",
  "1",
]);

const falsyTokens = new Set([
  "not approved",
  "invalid",
  "fail",
  "failed",
  "false",
  "no",
  "0",
]);

const normaliseCandidate = (value: unknown): NormalisedApprovalStatus | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? "Approved" : "Not Approved";
  }

  const candidate = String(value).trim();
  if (!candidate) {
    return null;
  }

  const lower = candidate.toLowerCase();

  if (truthyTokens.has(lower)) {
    return "Approved";
  }

  if (falsyTokens.has(lower)) {
    return "Not Approved";
  }

  if (lower.includes("approved") && !lower.includes("not")) {
    return "Approved";
  }

  if (lower.includes("not") && lower.includes("approved")) {
    return "Not Approved";
  }

  return null;
};

const candidateKeys = [
  "Approval",
  "approval",
  "Approval Status",
  "approval_status",
  "ApprovalStatus",
  "Outcome Status",
  "outcome_status",
  "QC Status",
  "qc_status",
];

export const determineApprovalStatus = (
  row: Record<string, unknown>,
): NormalisedApprovalStatus => {
  for (const key of candidateKeys) {
    if (key in row) {
      const value = (row as Record<string, unknown>)[key];
      const status = normaliseCandidate(value);
      if (status) {
        return status;
      }
    }
  }

  const qualityMetadata = row.qualityMetadata;
  if (
    qualityMetadata &&
    typeof qualityMetadata === "object" &&
    "isValid" in qualityMetadata
  ) {
    const metaValid = normaliseCandidate(
      (qualityMetadata as Record<string, unknown>).isValid,
    );
    if (metaValid) {
      return metaValid;
    }
  }

  return "Not Approved";
};

