export type Row = Record<string, any>;

const isYes = (value: unknown) => String(value ?? "").trim().toLowerCase() === "yes";
const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const hasGps = (row: Row) => {
  const lat = toNumber(row.latitude ?? row.lat ?? row["_A5. GPS Coordinates_latitude"]);
  const lng = toNumber(row.longitude ?? row.lng ?? row["_A5. GPS Coordinates_longitude"]);
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !(lat === 0 && lng === 0)
  );
};

export function getSubmissionMetrics(rows: Row[], requireGps = false) {
  const normalized = rows.map((row) => ({ State: row.State || "Ogun State", ...row }));
  const total = normalized.length;
  const approved = normalized.filter(
    (row) =>
      isYes(row["A6. Consent to participate"]) && (!requireGps || hasGps(row))
  ).length;
  const notApproved = total - approved;
  return { total, approved, notApproved };
}
