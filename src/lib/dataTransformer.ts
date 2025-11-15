/**
 * Google Sheets Data Transformer for OGSTEP Survey Dashboard
 * Maps raw Google Sheets data to dashboard-ready format
 */

// Type definitions matching your Google Sheets structure
export interface RawSurveyRow {
  // Metadata
  _id?: string;
  _uuid?: string;
  _submission_time?: string;
  _validation_status?: string;
  _status?: string;
  _submitted_by?: string;

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

  // OGSTEP Participation
  "B1. Are you aware of OGSTEP?"?: string;
  "B2. Did you participate in OGSTEP?"?: string;

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
 * Determine OGSTEP path from B2 response
 */
function getOgstepPath(row: RawSurveyRow): "treatment" | "control" | "unknown" {
  const response = getTextValue(row, [
    "B2. Did you participate in OGSTEP?",
    "b2_did_you_participate_in_ogstep",
  ]);

  if (!response) return "unknown";

  const lower = response.toLowerCase().trim();
  if (lower.startsWith("y") || lower === "1" || lower === "yes") return "treatment";
  if (lower.startsWith("n") || lower === "0" || lower === "no") return "control";
  return "unknown";
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

/**
 * Extract all error codes/flags from a row
 */
function extractErrorCodes(row: RawSurveyRow): string[] {
  const errors: string[] = [];
  
  // Check all QC_FLAG fields
  Object.keys(row).forEach((key) => {
    if (key.startsWith("QC_FLAG_") && isTruthy(row[key])) {
      errors.push(key);
    }
    if (key.startsWith("QC_WARN_") && isTruthy(row[key])) {
      errors.push(key);
    }
  });

  return errors;
}

/**
 * Determine approval status based on QC flags
 */
function determineApprovalStatus(row: RawSurveyRow): "approved" | "not_approved" {
  // Check explicit approval column first
  const approvalField = getTextValue(row, ["Approval", "QC Status"]);
  if (approvalField) {
    const lower = approvalField.toLowerCase();
    if (lower.includes("approve") || lower === "approved") return "approved";
    if (lower.includes("reject") || lower === "not approved") return "not_approved";
  }

  // Check if there are any QC flags
  const flagCount = parseNumber(row.QC_FLAG_COUNT);
  if (flagCount > 0) return "not_approved";

  // Check for any active flags
  const hasFlags = Object.keys(row).some(
    (key) => key.startsWith("QC_FLAG_") && isTruthy(row[key])
  );

  return hasFlags ? "not_approved" : "approved";
}

/**
 * Transform raw Google Sheets data to map submission format
 */
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

      return {
        id: row._uuid || row._id || `submission-${Math.random()}`,
        lat: parseNumber(row["_A5. GPS Coordinates_latitude"]),
        lng: parseNumber(row["_A5. GPS Coordinates_longitude"]),
        interviewerId,
        lga,
        state,
        errorTypes: extractErrorCodes(row),
        timestamp: row._submission_time || row["A2. Date"] || new Date().toISOString(),
        status: determineApprovalStatus(row),
        ogstepPath: getOgstepPath(row),
        ogstepResponse: getTextValue(row, ["B2. Did you participate in OGSTEP?"]),
        directions: row.Direction || null,
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

    if (!interviewerMap.has(interviewerId)) {
      interviewerMap.set(interviewerId, {
        interviewerId,
        interviewerName: interviewerId,
        displayLabel: interviewerId,
        total: 0,
        approved: 0,
        notApproved: 0,
        treatmentPathCount: 0,
        controlPathCount: 0,
        unknownPathCount: 0,
      });
    }

    const entry = interviewerMap.get(interviewerId)!;
    entry.total += 1;

    const status = determineApprovalStatus(row);
    if (status === "approved") {
      entry.approved += 1;
    } else {
      entry.notApproved += 1;
    }

    const path = getOgstepPath(row);
    if (path === "treatment") entry.treatmentPathCount += 1;
    else if (path === "control") entry.controlPathCount += 1;
    else entry.unknownPathCount += 1;
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

    const path = getOgstepPath(row);
    if (path === "treatment") entry.treatmentPathCount += 1;
    else if (path === "control") entry.controlPathCount += 1;
    else entry.unknownPathCount += 1;
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
  const errorMap = new Map<string, number>();

  rawData.forEach((row) => {
    const errors = extractErrorCodes(row);
    errors.forEach((error) => {
      errorMap.set(error, (errorMap.get(error) || 0) + 1);
    });
  });

  const totalErrors = Array.from(errorMap.values()).reduce((sum, count) => sum + count, 0);

  return Array.from(errorMap.entries())
    .map(([errorType, count]) => ({
      errorType,
      count,
      percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
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

    const path = getOgstepPath(row);
    if (path === "treatment") treatmentPathCount += 1;
    else if (path === "control") controlPathCount += 1;
    else unknownPathCount += 1;

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
  return {
    mapSubmissions: transformToMapSubmissions(rawData),
    achievementsByInterviewer: calculateAchievementsByInterviewer(rawData),
    achievementsByLGA: calculateAchievementsByLGA(rawData),
    errorBreakdown: calculateErrorBreakdown(rawData),
    lgas: extractUniqueLGAs(rawData),
    summary: calculateSummary(rawData, overallTarget),
    analysisRows: rawData,
  };
}
