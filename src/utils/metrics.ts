import { determineApprovalCategory } from "./approval";

export type Row = Record<string, unknown>;

export function getSubmissionMetrics(rows: Row[], _requireGps = false) {
  const normalized = rows.map((row) => ({ State: row.State || "Ogun State", ...row }));
  const total = normalized.length;

  let approved = 0;
  let notApproved = 0;
  let canceled = 0;

  normalized.forEach((row) => {
    const status = determineApprovalCategory(row);
    if (status === "Approved") {
      approved += 1;
    } else if (status === "Canceled") {
      canceled += 1;
    } else {
      notApproved += 1;
    }
  });

  const valid = approved + notApproved + canceled;

  return { total, approved, notApproved, canceled, valid };
}
