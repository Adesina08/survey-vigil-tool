import { determineApprovalStatus } from "./approval";

export type Row = Record<string, any>;

export function getSubmissionMetrics(rows: Row[], _requireGps = false) {
  const normalized = rows.map((row) => ({ State: row.State || "Ogun State", ...row }));
  const total = normalized.length;
  const approved = normalized.filter(
    (row) => determineApprovalStatus(row) === "Approved",
  ).length;
  const notApproved = total - approved;
  return { total, approved, notApproved };
}
