/**
 * Google Sheets Data Transformer for the survey dashboard
 * Maps raw Google Sheets data to dashboard-ready format
 */
import { PILLAR_FIELD_NAME } from "@/constants/pillar";
import { normaliseErrorType, type ErrorTypeInfo } from "./errorTypes";

import { determineApprovalStatus as normaliseApprovalStatus, findApprovalFieldValue } from "@/utils/approval";
import { extractErrorCodes } from "@/utils/errors";

const extractErrorTypes = (row: RawSurveyRow): ErrorTypeInfo[] => {
  const codes = extractErrorCodes(row as Record<string, unknown>);
  const unique = new Map<string, ErrorTypeInfo>();

  codes.forEach((code) => {
    const info = normaliseErrorType(code);
    if (!unique.has(info.slug)) {
      unique.set(info.slug, info);
    }
  });

  return Array.from(unique.values());
};

// Type definitions matching your Google Sheets structure
export interface RawSurveyRow {
  // Metadata
  _id?: string;
  _uuid?: string;
  _submission_time?: string;
  _validation_status?: string;
  _status?: string;
  _submitted_by?: string;
  _notes?: unknown;
  __version__?: string;
  _tags?: string | string[];
  _index?: string | number;
  start?: string;
  end?: string;
  today?: string;
  username?: string;
  phonenumber?: string;
  deviceid?: string;
  imei?: string;
  subscriberid?: string;
  simserial?: string;

  // Identifiers
  "A1. Enumerator ID"?: string;
  "Interviewer number"?: string;
  "A2. Date"?: string;
  "A3. select the LGA"?: string;
  "A3b. Select the Ward"?: string;
  State?: string;

  // GPS
  "_A5. GPS Coordinates_latitude"?: string | number;
  "_A5. GPS Coordinates_longitude"?: string | number;
  Direction?: string;

  // Demographics
  "A7. Sex"?: string;
  "A8. Age"?: string | number;

  // Pillar assignment
  "Pillar. Interviewers,  kindly recruit the respondent into the right Pillar according to your target"?: string;

  // Quality Control Flags (FLAGS)
  QC_FLAG_LOW_LOI?: string | number;
  QC_FLAG_HIGH_LOI?: string | number;
  QC_FLAG_ODD_HOUR?: string | number;
  QC_FLAG_SHORT_GAP?: string | number;
  QC_FLAG_INTERWOVEN?: string | number;
  QC_FLAG_CLUSTERED_INTERVIEW?: string | number;
  QC_FLAG_DUPLICATE_PHONE?: string | number;
  QC_FLAG_DUPLICATE_GPS?: string | number;
  QC_FLAG_INVALID_AGE?: string | number;
  QC_FLAG_INVALID_HOUSEHOLD_SIZE?: string | number;
  QC_FLAG_INVALID_INCOME?: string | number;
  QC_FLAG_INVALID_WORKING_HOURS?: string | number;
  QC_FLAG_INVALID_FARM_SIZE?: string | number;
  QC_FLAG_INVALID_YEAR_JOINED?: string | number;
  QC_FLAG_INVALID_DURATION_MONTHS_?: string | number;
  QC_FLAG_INVALID_DISTANCE_TO_MARKET?: string | number;
  QC_FLAG_INVALID_YIELD_LAST_SEASON_?: string | number;
  QC_FLAG_INVALID_QUANTITY_SOLD?: string | number;
  QC_FLAG_INVALID_AVERAGE_PRICE?: string | number;
  QC_FLAG_INVALID_INPUT_COST?: string | number;
  QC_FLAG_INVALID_TOTAL_REVENUE?: string | number;
  QC_FLAG_INVALID_MONTHLY_REVENUE?: string | number;
  QC_FLAG_INVALID_MONTHLY_COST?: string | number;
  QC_FLAG_REVENUE_PRICE_QUANTITY_MISMATCH?: string | number;
  QC_FLAG_BUSINESS_PROFIT_ERROR?: string | number;
  QC_FLAG_SKIP_LOGIC_VIOLATION?: string | number;
  QC_FLAG_OUTSIDE_LGA_BOUNDARY?: string | number;

  // Quality Control Warnings (WARNS)
  QC_WARN_POOR_GPS_ACCURACY?: string | number;
  QC_WARN_PROFIT_VS_HOUSEHOLD_INCOME_MISMATCH?: string | number;
  QC_WARN_UNEMPLOYED_WITH_INCOME?: string | number;
  QC_WARN_UNEMPLOYED_WITH_HOURS?: string | number;
  QC_WARN_LOW_INCOME_EMPLOYED_?: string | number;
  QC_WARN_LOW_WORKING_HOURS?: string | number;
  QC_WARN_QUANTITY_SOLD_OUT_OF_RANGE_?: string | number;
  QC_WARN_INPUT_COST_OUT_OF_RANGE_?: string | number;
  QC_WARN_TOTAL_REVENUE_OUT_OF_RANGE_?: string | number;
  QC_WARN_DISTANCE_TO_MARKET_HIGH_?: string | number;
  QC_WARN_RETROSPECTIVE_YIELD_LOW_?: string | number;
  QC_WARN_EMPLOYEES_TOTAL_OUT_OF_RANGE_?: string | number;
  QC_WARN_MONTHLY_REVENUE_OUT_OF_RANGE_?: string | number;
  QC_WARN_MONTHLY_COST_OUT_OF_RANGE_?: string | number;
  QC_WARN_MONTHLY_PROFIT_LOW_?: string | number;

  // Status
  "QC Status"?: string;
  Approval?: string;
  "QC Issues"?: string;
  QC_FLAG_COUNT?: string | number;

  [key: string]: any; // Allow other fields
}

/**
 * Helper function to safely get a text value from multiple possible column names
 */
function getTextValue(row: RawSurveyRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

/**
 * Helper function to safely parse a number
 */
function parseNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

const normaliseMetadataValue = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return String(value).trim() || null;
};

const getMinutesDifferenceLabel = (row: RawSurveyRow): string | null => {
  const candidates = [
    row["Minutes Difference"],
    (row as Record<string, unknown>).minutes_difference,
    (row as Record<string, unknown>).minutesDifference,
    (row as Record<string, unknown>)["minutes difference"],
  ];

  for (const candidate of candidates) {
    const value = normaliseMetadataValue(candidate);
    if (value) {
      return value;
    }
  }

  return null;
};

/**
 * Check if a value represents "true" or "1"
 */
function isTruthy(value: any): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    return lower === "1" || lower === "true" || lower === "yes";
  }
  return false;
}

/**
 * Determine respondent path from the Pillar field
 */
function getPillarPath(row: RawSurveyRow): "treatment" | "control" | "unknown" | null {
  const pillar = getTextValue(row, [PILLAR_FIELD_NAME]);

  if (!pillar) return null;

  const normalised = pillar.toUpperCase();
  if (normalised.includes("TREATMENT")) return "treatment";
  if (normalised.includes("CONTROL")) return "control";
  if (normalised.includes("UNQUALIFIED")) return "unknown";

  return null;
}

function getGenderValue(row: RawSurveyRow): "male" | "female" | "unknown" {
  const value =
    getTextValue(row, [
      "A7. Sex",
      "a7_sex",
      "Gender",
      "gender",
      "respondent_gender",
      "respondent sex",
    ]) || null;

  if (!value) {
    return "unknown";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("m")) return "male";
  if (normalized.startsWith("f")) return "female";
  return "unknown";
}

const parseDateValue = (value: unknown): Date | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  // Attempt to coerce to ISO by appending Z if missing timezone
  const coerced = new Date(`${trimmed}Z`);
  if (!Number.isNaN(coerced.getTime())) {
    return coerced;
  }

  return null;
};

const getRowTimestamp = (row: RawSurveyRow): Date | null => {
  const candidates: Array<unknown> = [
    row._submission_time,
    row.end,
    row.today,
    row.start,
  ];

  for (const candidate of candidates) {
    const parsed = parseDateValue(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

/**
 * Determine approval status using shared normalisation logic
 */
function determineApprovalStatus(row: RawSurveyRow): "approved" | "not_approved" {
  const status = normaliseApprovalStatus(row as unknown as Record<string, unknown>);
  return status === "Approved" ? "approved" : "not_approved";
}

/**
 * Transform raw Google Sheets data to map submission format
 */
const QC_FLAG_REGEX = /^QC_(FLAG|WARN)_/i;

const getQcFlagSlugs = (row: RawSurveyRow): Set<string> => {
  const slugs = new Set<string>();

  Object.entries(row).forEach(([key, value]) => {
    if (!QC_FLAG_REGEX.test(key)) {
      return;
    }

    const numericValue = parseNumber(value);
    if (numericValue > 0) {
      slugs.add(normaliseErrorType(key).slug);
    }
  });

  return slugs;
};

const normaliseGenderLabel = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("m")) {
    return "Male";
  }
  if (lower.startsWith("f")) {
    return "Female";
  }
  return trimmed;
};

export function transformToMapSubmissions(rawData: RawSurveyRow[]) {
  return rawData
    .filter((row) => {
      const lat = parseNumber(row["_A5. GPS Coordinates_latitude"]);
      const lng = parseNumber(row["_A5. GPS Coordinates_longitude"]);
      return lat !== 0 && lng !== 0;
    })
    .map((row) => {
      const interviewerId = getTextValue(row, [
        "A1. Enumerator ID",
        "Interviewer number",
        "_submitted_by",
      ]) || "Unknown";

      const lga = getTextValue(row, ["A3. select the LGA", "A3. Select the LGA"]) || "Unknown";
      const state = getTextValue(row, ["State"]) || "Ogun";

      const interviewerName =
        getTextValue(row, [
          "Enumerator Name",
          "Interviewer Name",
          "enumerator_name",
          "interviewer_name",
        ]) || interviewerId;

      const interviewerLabel =
        interviewerName && interviewerName !== interviewerId
          ? `${interviewerId} · ${interviewerName}`
          : interviewerId;

      const approvalField = findApprovalFieldValue(row as unknown as Record<string, unknown>);
      const status = determineApprovalStatus(row);
      const approvalLabel = approvalField?.value ?? (status === "approved" ? "Approved" : "Not Approved");
      const approvalSource = approvalField?.key ?? null;

      const qcFlagSlugs = getQcFlagSlugs(row);

      const combinedFlagSlugs = new Set<string>();
      extractErrorCodes(row as unknown as Record<string, unknown>).forEach((code) => {
        combinedFlagSlugs.add(normaliseErrorType(code).slug);
      });
      qcFlagSlugs.forEach((slug) => combinedFlagSlugs.add(slug));

      const qcFlags = Array.from(qcFlagSlugs);
      const otherFlags = Array.from(combinedFlagSlugs).filter((slug) => !qcFlagSlugs.has(slug));

      const respondentName =
        getTextValue(row, ["Respondent name", "respondent_name", "Name of respondent"]) ?? null;
      const respondentPhone =
        getTextValue(row, [
          "Respondent phone number",
          "respondent_phone_number",
          "Respondent Phone",
          "phone",
        ]) ?? null;
      const respondentGender = normaliseGenderLabel(
        getTextValue(row, [
          "A7. Sex",
          "Gender",
          "gender",
          "respondent_gender",
          "respondent sex",
        ]) ?? null,
      );
      const respondentAge = getTextValue(row, ["A8. Age", "respondent_age", "Age"]);
      const ward = getTextValue(row, ["A3b. Select the Ward", "Ward"]);
      const community = getTextValue(row, ["A4. Community / Village", "Community", "Village"]);
      const consent = getTextValue(row, ["A6. Consent to participate", "Consent"]);
      const qcStatus = getTextValue(row, ["QC Status", "qc_status"]);
      const submissionUuid = normaliseMetadataValue(row._uuid);
      const submissionIndex = normaliseMetadataValue(row._index);
      const minutesDifference = getMinutesDifferenceLabel(row);

      const allFlags = Array.from(combinedFlagSlugs);

      return {
        id: row._uuid || row._id || `submission-${Math.random()}`,
        lat: parseNumber(row["_A5. GPS Coordinates_latitude"]),
        lng: parseNumber(row["_A5. GPS Coordinates_longitude"]),
        interviewerId,
        interviewerName,
        interviewerLabel,
        lga,
        state,
        errorTypes: allFlags,
        qcFlags,
        otherFlags,
        timestamp:
          row._submission_time ||
          row["A2. Date"] ||
          new Date().toISOString(),
        status,
        approvalLabel,
        approvalSource,
        pillarPath: getPillarPath(row),
        pillarAssignment: getTextValue(row, [PILLAR_FIELD_NAME]),
        directions: row.Direction || null,
        respondentName,
        respondentPhone,
        respondentGender,
        respondentAge,
        ward,
        community,
        consent,
        qcStatus,
        submissionUuid,
        submissionIndex,
        minutesDifference,
      };
    });
}

/**
 * Calculate achievements by interviewer
 */
export function calculateAchievementsByInterviewer(rawData: RawSurveyRow[]) {
  const interviewerMap = new Map<string, any>();

  rawData.forEach((row) => {
    const interviewerId = getTextValue(row, [
      "A1. Enumerator ID",
      "Interviewer number",
      "_submitted_by",
    ]) || "Unknown";

    const interviewerName =
      getTextValue(row, [
        "Enumerator name",
        "Interviewer Name",
        "interviewer_name",
        "username",
      ]) || interviewerId;

    if (!interviewerMap.has(interviewerId)) {
      interviewerMap.set(interviewerId, {
        interviewerId,
        interviewerName,
        displayLabel:
          interviewerName && interviewerName !== interviewerId
            ? `${interviewerId} · ${interviewerName}`
            : interviewerId,
        total: 0,
        approved: 0,
        notApproved: 0,
        treatmentPathCount: 0,
        controlPathCount: 0,
        unknownPathCount: 0,
      });
    }

    const entry = interviewerMap.get(interviewerId)!;
    entry.interviewerName = interviewerName;
    entry.displayLabel =
      interviewerName && interviewerName !== interviewerId
        ? `${interviewerId} · ${interviewerName}`
        : interviewerId;
    entry.total += 1;

    const status = determineApprovalStatus(row);
    if (status === "approved") {
      entry.approved += 1;
    } else {
      entry.notApproved += 1;
    }

    const path = getPillarPath(row);
    if (path === "treatment") entry.treatmentPathCount += 1;
    else if (path === "control") entry.controlPathCount += 1;
    else if (path === "unknown") entry.unknownPathCount += 1;
  });

  return Array.from(interviewerMap.values()).map((entry) => ({
    ...entry,
    percentageApproved: entry.total > 0 ? (entry.approved / entry.total) * 100 : 0,
  }));
}

/**
 * Calculate achievements by LGA
 */
export function calculateAchievementsByLGA(rawData: RawSurveyRow[]) {
  const lgaMap = new Map<string, any>();

  rawData.forEach((row) => {
    const lga = getTextValue(row, ["A3. select the LGA", "A3. Select the LGA"]) || "Unknown";
    const state = getTextValue(row, ["State"]) || "Ogun";

    if (!lgaMap.has(lga)) {
      lgaMap.set(lga, {
        lga,
        state,
        total: 0,
        approved: 0,
        notApproved: 0,
        treatmentPathCount: 0,
        controlPathCount: 0,
        unknownPathCount: 0,
      });
    }

    const entry = lgaMap.get(lga)!;
    entry.total += 1;

    const status = determineApprovalStatus(row);
    if (status === "approved") {
      entry.approved += 1;
    } else {
      entry.notApproved += 1;
    }

    const path = getPillarPath(row);
    if (path === "treatment") entry.treatmentPathCount += 1;
    else if (path === "control") entry.controlPathCount += 1;
    else if (path === "unknown") entry.unknownPathCount += 1;
  });

  return Array.from(lgaMap.values())
    .map((entry) => ({
      ...entry,
      percentageApproved: entry.total > 0 ? (entry.approved / entry.total) * 100 : 0,
    }))
    .sort((a, b) => a.lga.localeCompare(b.lga));
}

/**
 * Calculate error breakdown
 */
export function calculateErrorBreakdown(rawData: RawSurveyRow[]) {
  const errorMap = new Map<string, { info: ErrorTypeInfo; count: number }>();

  rawData.forEach((row) => {
    const errors = extractErrorTypes(row);
    errors.forEach((info) => {
      const existing = errorMap.get(info.slug);
      if (existing) {
        errorMap.set(info.slug, {
          info: existing.info,
          count: existing.count + 1,
        });
      } else {
        errorMap.set(info.slug, {
          info,
          count: 1,
        });
      }
    });
  });

  const totals = Array.from(errorMap.values());
  const totalErrors = totals.reduce((sum, entry) => sum + entry.count, 0);

  return totals
    .map(({ info, count }) => ({
      code: info.slug,
      errorType: info.label,
      relatedVariables: info.relatedVariables,
      count,
      percentage: totalErrors > 0 ? Number(((count / totalErrors) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate achievements by state
 */
export function calculateAchievementsByState(rawData: RawSurveyRow[]) {
  const stateMap = new Map<string, any>();

  rawData.forEach((row) => {
    const state = getTextValue(row, ["State"]) || "Unknown";

    if (!stateMap.has(state)) {
      stateMap.set(state, {
        state,
        total: 0,
        approved: 0,
        notApproved: 0,
        treatmentPathCount: 0,
        controlPathCount: 0,
        unknownPathCount: 0,
      });
    }

    const entry = stateMap.get(state)!;
    entry.total += 1;

    const status = determineApprovalStatus(row);
    if (status === "approved") {
      entry.approved += 1;
    } else {
      entry.notApproved += 1;
    }

    const path = getPillarPath(row);
    if (path === "treatment") entry.treatmentPathCount += 1;
    else if (path === "control") entry.controlPathCount += 1;
    else if (path === "unknown") entry.unknownPathCount += 1;
  });

  return Array.from(stateMap.values())
    .map((entry) => ({
      ...entry,
      percentageApproved: entry.total > 0 ? (entry.approved / entry.total) * 100 : 0,
    }))
    .sort((a, b) => a.state.localeCompare(b.state));
}

/**
 * Extract unique LGAs from data
 */
export function extractUniqueLGAs(rawData: RawSurveyRow[]): string[] {
  const lgaSet = new Set<string>();
  rawData.forEach((row) => {
    const lga = getTextValue(row, ["A3. select the LGA", "A3. Select the LGA"]);
    if (lga) lgaSet.add(lga);
  });
  return Array.from(lgaSet).sort();
}

/**
 * Get summary statistics
 */
export function calculateSummary(rawData: RawSurveyRow[], overallTarget: number = 0) {
  let totalSubmissions = 0;
  let approvedSubmissions = 0;
  let notApprovedSubmissions = 0;
  let treatmentPathCount = 0;
  let controlPathCount = 0;
  let unknownPathCount = 0;
  let maleCount = 0;
  let femaleCount = 0;

  rawData.forEach((row) => {
    totalSubmissions += 1;

    const status = determineApprovalStatus(row);
    if (status === "approved") {
      approvedSubmissions += 1;
    } else {
      notApprovedSubmissions += 1;
    }

    const path = getPillarPath(row);
    if (path === "treatment") treatmentPathCount += 1;
    else if (path === "control") controlPathCount += 1;
    else if (path === "unknown") unknownPathCount += 1;

    const gender = getGenderValue(row);
    if (gender === "male") maleCount += 1;
    else if (gender === "female") femaleCount += 1;
  });

  const approvalRate = totalSubmissions > 0 ? (approvedSubmissions / totalSubmissions) * 100 : 0;
  const notApprovedRate = totalSubmissions > 0 ? (notApprovedSubmissions / totalSubmissions) * 100 : 0;
  const completionRate = overallTarget > 0 ? (approvedSubmissions / overallTarget) * 100 : 0;

  return {
    overallTarget,
    totalSubmissions,
    approvedSubmissions,
    approvalRate: Number(approvalRate.toFixed(1)),
    notApprovedSubmissions,
    notApprovedRate: Number(notApprovedRate.toFixed(1)),
    completionRate: Number(completionRate.toFixed(1)),
    treatmentPathCount,
    controlPathCount,
    unknownPathCount,
    maleCount,
    femaleCount,
  };
}

/**
 * Main transformer function - converts raw Google Sheets data to dashboard format
 */
export function transformGoogleSheetsData(rawData: RawSurveyRow[], overallTarget: number = 0) {
  const achievementsByInterviewer = calculateAchievementsByInterviewer(rawData);
  const achievementsByLGA = calculateAchievementsByLGA(rawData);
  const achievementsByState = calculateAchievementsByState(rawData);
  let latestSubmission: Date | null = null;

  rawData.forEach((row) => {
    const timestamp = getRowTimestamp(row);
    if (timestamp && (!latestSubmission || timestamp > latestSubmission)) {
      latestSubmission = timestamp;
    }
  });

  return {
    mapSubmissions: transformToMapSubmissions(rawData),
    achievementsByInterviewer,
    achievementsByLGA,
    achievements: {
      byState: achievementsByState,
      byInterviewer: achievementsByInterviewer,
      byLGA: achievementsByLGA,
    },
    errorBreakdown: calculateErrorBreakdown(rawData),
    lgas: extractUniqueLGAs(rawData),
    summary: calculateSummary(rawData, overallTarget),
    analysisRows: rawData,
    lastUpdated: latestSubmission ? latestSubmission.toISOString() : "",
  };
}
