import { normaliseHeaderKey } from "@/lib/googleSheets";

export type QuotaRecord = Record<string, unknown>;

export interface QuotaMappers {
  getSex: (record: QuotaRecord) => string;
  getAge: (record: QuotaRecord) => number | null;
  isYouth: (record: QuotaRecord) => boolean;
  getPillar: (record: QuotaRecord) => string;
  getArm: (record: QuotaRecord) => string;
  getLga?: (record: QuotaRecord) => string;
  getWard?: (record: QuotaRecord) => string;
}

const getValue = (record: QuotaRecord, ...candidates: string[]): unknown => {
  for (const candidate of candidates) {
    const key = normaliseHeaderKey(candidate);
    if (key && key in record) {
      return record[key];
    }
  }
  return undefined;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const toString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return String(value).trim();
};

export const quotaMappers: QuotaMappers = {
  getSex: (record) =>
    toString(
      getValue(
        record,
        "A7. Sex",
        "Sex",
        "Gender",
        "respondent_sex",
        "respondent_gender",
      ),
    ),
  getAge: (record) =>
    toNumber(
      getValue(record, "A8. Age", "Age", "Respondent Age", "age_years"),
    ),
  isYouth: (record) => {
    const age = quotaMappers.getAge(record);
    return typeof age === "number" ? age <= 35 : false;
  },
  getPillar: (record) =>
    toString(
      getValue(
        record,
        "Pillar",
        "Project Pillar",
        "programme_pillar",
        "survey_tool",
      ),
    ) || "Households",
  getArm: (record) =>
    toString(getValue(record, "Study Arm", "Arm", "assignment_arm")) || "Comparison",
  getLga: (record) =>
    toString(
      getValue(
        record,
        "A3. select the LGA",
        "LGA",
        "LGA of interview",
        "lga_name",
      ),
    ),
  getWard: (record) =>
    toString(
      getValue(
        record,
        "A3b. Select the Ward",
        "Ward",
        "ward_name",
        "ward",
      ),
    ),
};
