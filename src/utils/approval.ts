export type NormalisedApprovalStatus = "Approved" | "Not Approved";
export type NormalisedApprovalCategory = NormalisedApprovalStatus | "Canceled";

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

const cancellationTokens = new Set([
  "cancel",
  "canceled",
  "cancelled",
  "cancellation",
  "cancelation",
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

  // e.g. "Approved - QC passed"
  if (lower.includes("approved") && !lower.includes("not")) {
    return "Approved";
  }

  // e.g. "Not approved - failed QC"
  if (lower.includes("not") && lower.includes("approved")) {
    return "Not Approved";
  }

  return null;
};

const normaliseCandidateWithCancellation = (
  value: unknown,
): NormalisedApprovalCategory | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned) {
      return null;
    }

    const lower = cleaned.toLowerCase();

    // 🔥 Anything containing a cancel token is treated as Canceled
    // e.g. "Canceled", "Cancelled interview", "Interview canceled by respondent"
    if ([...cancellationTokens].some((token) => lower.includes(token))) {
      return "Canceled";
    }
  }

  // Otherwise, fall back to normal Approved / Not Approved logic
  return normaliseCandidate(value);
};

// 👇 Expanded to cover common header variants for the Approval column
export const APPROVAL_FIELD_CANDIDATES = [
  "Approval",
  "approval",
  "Approval Status",
  "Approval status",
  "approval_status",
  "ApprovalStatus",
  "Outcome Status",
  "outcome_status",
  "QC Status",
  "qc_status",
] as const;

export type ApprovalFieldKey = (typeof APPROVAL_FIELD_CANDIDATES)[number];

const normaliseApprovalFieldValue = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "boolean") {
    return value ? "Approved" : "Not Approved";
  }

  return String(value ?? "").trim() || null;
};

export const findApprovalFieldValue = (
  row: Record<string, unknown>,
): { key: string; value: string } | null => {
  for (const key of APPROVAL_FIELD_CANDIDATES) {
    if (key in row) {
      const rawValue = (row as Record<string, unknown>)[key];
      const normalised = normaliseApprovalFieldValue(rawValue);
      if (normalised) {
        return { key, value: normalised };
      }
    }
  }

  const normalizeKey = (key: string) => key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const approvalLikeKeys = Object.keys(row).filter((key) => {
    const normalisedKey = normalizeKey(key);
    return (
      normalisedKey.includes("approval") ||
      normalisedKey.includes("approvalstatus") ||
      normalisedKey.includes("outcomestatus") ||
      normalisedKey.includes("qcstatus")
    );
  });

  for (const key of approvalLikeKeys) {
    const rawValue = (row as Record<string, unknown>)[key];
    const normalised = normaliseApprovalFieldValue(rawValue);
    if (normalised) {
      return { key, value: normalised };
    }
  }

  return null;
};

export const determineApprovalStatus = (
  row: Record<string, unknown>,
): NormalisedApprovalStatus => {
  const approvalField = findApprovalFieldValue(row);
  if (approvalField) {
    const status = normaliseCandidate(approvalField.value);
    if (status) {
      return status;
    }
  }

  // 2) Fallback to qualityMetadata.isValid if present
  const qualityMetadata = (row as Record<string, unknown>).qualityMetadata;
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

  // 3) Default
  return "Not Approved";
};

export const determineApprovalCategory = (
  row: Record<string, unknown>,
): NormalisedApprovalCategory => {
  const approvalField = findApprovalFieldValue(row);
  if (approvalField) {
    const status = normaliseCandidateWithCancellation(approvalField.value);
    if (status) {
      return status;
    }
  }

  // 2) Fallback to qualityMetadata.isValid, including cancellation
  const qualityMetadata = (row as Record<string, unknown>).qualityMetadata;
  if (
    qualityMetadata &&
    typeof qualityMetadata === "object" &&
    "isValid" in qualityMetadata
  ) {
    const metaValid = normaliseCandidateWithCancellation(
      (qualityMetadata as Record<string, unknown>).isValid,
    );
    if (metaValid) {
      return metaValid;
    }
  }

  // 3) Default
  return "Not Approved";
};
