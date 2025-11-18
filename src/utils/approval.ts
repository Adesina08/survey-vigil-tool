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

  if (lower.includes("approved") && !lower.includes("not")) {
    return "Approved";
  }

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
    if ([...cancellationTokens].some((token) => lower.includes(token))) {
      return "Canceled";
    }
  }

  return normaliseCandidate(value);
};

export const APPROVAL_FIELD_CANDIDATES = [
  "Approval"
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
): { key: ApprovalFieldKey; value: string } | null => {
  for (const key of APPROVAL_FIELD_CANDIDATES) {
    if (key in row) {
      const rawValue = (row as Record<string, unknown>)[key];
      const normalised = normaliseApprovalFieldValue(rawValue);
      if (normalised) {
        return { key, value: normalised };
      }
    }
  }

  return null;
};

export const determineApprovalStatus = (
  row: Record<string, unknown>,
): NormalisedApprovalStatus => {
  for (const key of APPROVAL_FIELD_CANDIDATES) {
    if (!(key in row)) {
      continue;
    }

    const value = (row as Record<string, unknown>)[key];
    const status = normaliseCandidate(value);
    if (status) {
      return status;
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

export const determineApprovalCategory = (
  row: Record<string, unknown>,
): NormalisedApprovalCategory => {
  for (const key of APPROVAL_FIELD_CANDIDATES) {
    if (!(key in row)) {
      continue;
    }

    const value = (row as Record<string, unknown>)[key];
    const status = normaliseCandidateWithCancellation(value);
    if (status) {
      return status;
    }
  }

  const qualityMetadata = row.qualityMetadata;
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

  return "Not Approved";
};

