import { determineApprovalCategory } from "./approval";

export type Row = Record<string, unknown>;

export function getSubmissionMetrics(rows: Row[], _requireGps = false) {
  // Normalise State so it's always present (your existing behaviour)
  const normalized = rows.map((row) => ({
    State: (row as Record<string, unknown>).State || "Ogun State",
    ...row,
  }));

  const total = normalized.length;

  let approved = 0;
  let notApproved = 0;
  let canceled = 0;

  normalized.forEach((row) => {
    const status = determineApprovalCategory(row as Record<string, unknown>);

    if (status === "Approved") {
      approved += 1;
    } else if (status === "Canceled") {
      canceled += 1;
    } else {
      notApproved += 1;
    }
  });

  // ✅ Valid submissions = Approved + Not Approved + Canceled
  const valid = approved + notApproved + canceled;

  return {
    total,
    approved,
    notApproved,
    canceled,
    valid,
  };
}
