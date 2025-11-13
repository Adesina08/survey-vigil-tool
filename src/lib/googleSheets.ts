import type {
  AgeGroup,
  ApprovalStatus,
  ErrorType,
  Gender,
  SheetStateAgeTargetRow,
  SheetStateGenderTargetRow,
  SheetStateTargetRow,
  SheetSubmissionRow,
} from "@/types/sheets";

type NormalisedRow = Map<string, unknown>;

export const normaliseHeaderKey = (key: string): string => {
  const withoutHtml = key.replace(/<[^>]*>/g, "");
  const trimmed = withoutHtml.trim();
  if (!trimmed) {
    return "";
  }
  if (/^\*{2}.*\*{2}$/.test(trimmed)) {
    return trimmed;
  }
  const preserveLeadingUnderscore = trimmed.startsWith("_");
  const lower = trimmed.toLowerCase();
  const withUnderscores = lower
    .replace(/[\s./:()]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_");
  const withoutLeading = preserveLeadingUnderscore
    ? `_${withUnderscores.replace(/^_+/, "")}`
    : withUnderscores.replace(/^_+/, "");
  const normalised = withoutLeading.replace(/_+$/, "");
  return normalised || trimmed;
};

export const HEADER_ALIASES: Record<string, string> = {
  state: "State",
  statename: "State",
  lga: "A3. select the LGA",
  ward: "Ward",
  a3b_select_the_ward: "Ward",
  interviewer_number: "Interviewer ID",
  respondent_name: "Respondent Name",
  approval: "Approval Status",
  qc_status: "Outcome Status",
  phonenumber: "Respondent phone number",
  deviceid: "deviceid",
  imei: "Device IMEI",
  subscriberid: "Subscriber ID",
  simserial: "SIM Serial",
  gender: "A7. Sex",
  sex: "A7. Sex",
  age: "A8. Age",
  agegroup: "Age Group",
  age_group: "Age Group",
  enumeratorid: "A1. Enumerator ID",
  interviewerid: "A1. Enumerator ID",
  enumeratorname: "Enumerator Name",
  interviewername: "Enumerator Name",
  submissionid: "Submission ID",
  submissiondate: "Submission Date",
  submissiontime: "Submission Time",
  starttime: "start",
  endtime: "end",
  lat: "_A5. GPS Coordinates_latitude",
  latitude: "_A5. GPS Coordinates_latitude",
  lon: "_A5. GPS Coordinates_longitude",
  lng: "_A5. GPS Coordinates_longitude",
  longitude: "_A5. GPS Coordinates_longitude",
  gpscoordinates: "A5. GPS Coordinates",
  consent: "A6. Consent to participate",
  interview_duration: "Interview Length (mins)",
  state_target: "State Target",
  statetarget: "State Target",
  age_target: "Age Group Target",
  agetarget: "Age Group Target",
  age_group_target: "Age Group Target",
  gender_target: "Gender Target",
  gendertarget: "Gender Target",
  username: "username",
  submission_time: "_submission_time",
  submission_id: "_id",
  ogstep: "B2. Did you participate in OGSTEP?",
};

const aliasHeaderKey = (key: string): string => {
  const normalised = normaliseHeaderKey(key);
  const canonical = HEADER_ALIASES[normalised] ?? key;
  return normaliseHeaderKey(canonical);
};

const createNormalisedRow = (row: Record<string, unknown>): NormalisedRow => {
  const map: NormalisedRow = new Map();
  Object.entries(row).forEach(([rawKey, value]) => {
    if (typeof rawKey !== "string" || rawKey.length === 0) {
      return;
    }
    const key = aliasHeaderKey(rawKey);
    if (!map.has(key)) {
      map.set(key, value);
    }
  });
  return map;
};

const getFromRow = (row: NormalisedRow, ...candidates: string[]): unknown => {
  for (const candidate of candidates) {
    const normalised = normaliseHeaderKey(candidate);
    if (row.has(normalised)) {
      return row.get(normalised);
    }
  }
  return undefined;
};

const toStringValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || value instanceof Date) {
    return `${value}`;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return "";
};

const stripChoicePrefix = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+)\s*[.)-]?\s*(.+)$/);
  if (match && match[2]) {
    return match[2].trim();
  }
  return trimmed;
};

const normaliseChoiceText = (value: unknown): string => {
  const text = toStringValue(value);
  return stripChoicePrefix(text);
};

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.+-]/g, "");
    if (cleaned.length === 0) {
      return undefined;
    }
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const parseDateValue = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
};

const padNumber = (value: number): string => value.toString().padStart(2, "0");

const formatDatePart = (date: Date): string => {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  return `${year}-${month}-${day}`;
};

const formatTimePart = (date: Date): string => {
  const hours = padNumber(date.getHours());
  const minutes = padNumber(date.getMinutes());
  return `${hours}:${minutes}`;
};

const determineAgeGroup = (age?: number): AgeGroup => {
  if (typeof age !== "number" || Number.isNaN(age) || age <= 0) {
    return "Unknown";
  }
  if (age <= 24) return "15-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  return "45+";
};

const normaliseAgeGroupLabel = (value: string): AgeGroup => {
  const formatted = value.trim();
  const allowed: AgeGroup[] = ["15-24", "25-34", "35-44", "45+", "Unknown"];
  return allowed.includes(formatted as AgeGroup) ? (formatted as AgeGroup) : "Unknown";
};

const normaliseGender = (value: unknown): Gender => {
  const text = normaliseChoiceText(value).toLowerCase();
  if (text === "male" || text === "m" || text === "1") {
    return "Male";
  }
  if (text === "female" || text === "f" || text === "2") {
    return "Female";
  }
  return "Unknown";
};

const normaliseOgstepParticipation = (value: unknown): string | undefined => {
  const text = normaliseChoiceText(value);
  if (!text) {
    return undefined;
  }
  const lower = text.toLowerCase();
  if (lower.startsWith("y") || lower === "1" || lower === "yes" || lower === "true") {
    return "Yes";
  }
  if (lower.startsWith("n") || lower === "0" || lower === "no" || lower === "false") {
    return "No";
  }
  return text;
};

const interpretApprovalStatus = (value: unknown): ApprovalStatus | null => {
  const text = normaliseChoiceText(value);
  if (!text) {
    return null;
  }
  const lower = text.toLowerCase();
  const normalised = lower.replace(/[_\s-]+/g, " ").trim();
  const negativeTokens = new Set([
    "no",
    "0",
    "false",
    "not approved",
    "not valid",
    "invalid",
    "rejected",
    "reject",
    "2",
    "denied",
    "declined",
  ]);
  if (negativeTokens.has(normalised)) {
    return "Not Approved";
  }
  if (
    normalised.includes("not approved") ||
    normalised.includes("reject") ||
    normalised.includes("invalid")
  ) {
    return "Not Approved";
  }
  const positiveTokens = new Set([
    "yes",
    "1",
    "true",
    "approved",
    "valid",
    "consented",
    "consent given",
    "completed",
    "complete",
  ]);
  if (positiveTokens.has(normalised)) {
    return "Approved";
  }
  if (
    normalised.includes("approve") ||
    normalised.includes("valid") ||
    normalised.includes("yes")
  ) {
    return "Approved";
  }
  if (normalised.includes("no")) {
    return "Not Approved";
  }
  return null;
};

const deriveApprovalStatus = (row: NormalisedRow): ApprovalStatus => {
  const candidateHeaders = [
    "Approval Status",
    "Approval",
    "Outcome Status",
    "A6. Consent to participate",
    "Consent",
  ];
  for (const header of candidateHeaders) {
    const value = getFromRow(row, header);
    const interpreted = interpretApprovalStatus(value);
    if (interpreted) {
      return interpreted;
    }
  }
  return "Approved";
};

const normaliseErrorFlagKey = (value: string): string =>
  stripChoicePrefix(value)
    .replace(/[_\s-]+/g, " ")
    .trim()
    .toLowerCase();

const parseErrorFlags = (value: unknown): ErrorType[] => {
  const allowed: ErrorType[] = [
    "OddHour",
    "Low LOI",
    "High LOI",
    "Outside LGA Boundary",
    "DuplicatePhone",
    "Interwoven",
    "ShortGap",
    "ClusteredInterview",
    "Terminated",
  ];
  const lookup = new Map(allowed.map((flag) => [normaliseErrorFlagKey(flag), flag]));
  const resolve = (entry: unknown): ErrorType | null => {
    const key = normaliseErrorFlagKey(toStringValue(entry));
    return lookup.get(key) ?? null;
  };
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => resolve(entry))
      .filter((entry): entry is ErrorType => entry !== null);
  }
  const text = toStringValue(value);
  if (!text) {
    return [];
  }
  return text
    .split(/[;,]/)
    .map((part) => resolve(part))
    .filter((entry): entry is ErrorType => entry !== null);
};

const parseCoordinatePair = (
  value: string
): { lat: number; lng: number } | undefined => {
  if (!value) {
    return undefined;
  }
  const parts = value
    .split(/[\s,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < 2) {
    return undefined;
  }
  const lat = Number.parseFloat(parts[0]);
  const lng = Number.parseFloat(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return undefined;
  }
  return { lat, lng };
};

interface SubmissionMappingOptions {
  defaultState?: string;
}

export const mapSheetRowsToSubmissions = (
  rows: Record<string, unknown>[],
  { defaultState }: SubmissionMappingOptions = {}
): SheetSubmissionRow[] => {
  return rows
    .map((row, index) => {
      const normalisedRow = createNormalisedRow(row);
      const submissionId =
        toStringValue(getFromRow(normalisedRow, "_id", "_uuid")) || `submission-${index}`;
      const startDate = parseDateValue(getFromRow(normalisedRow, "start"));
      const endDate = parseDateValue(getFromRow(normalisedRow, "end"));
      const startIso = startDate?.toISOString();
      const endIso = endDate?.toISOString();
      const submissionDateSource =
        parseDateValue(getFromRow(normalisedRow, "A2. Date")) ??
        parseDateValue(getFromRow(normalisedRow, "today")) ??
        startDate ??
        endDate;
      const submissionDateString = submissionDateSource
        ? formatDatePart(submissionDateSource)
        : "";
      const submissionTimeString = startDate
        ? formatTimePart(startDate)
        : submissionDateSource
        ? formatTimePart(submissionDateSource)
        : "";
      const enumeratorId =
        toStringValue(getFromRow(normalisedRow, "A1. Enumerator ID")) || "Unknown";
      const enumeratorName =
        toStringValue(getFromRow(normalisedRow, "_submitted_by")) || enumeratorId;
      const username =
        normaliseChoiceText(getFromRow(normalisedRow, "username", "User Name")) || enumeratorId;
      const state =
        normaliseChoiceText(getFromRow(normalisedRow, "State", "State Name")) ||
        defaultState ||
        "Unknown State";
      const lga =
        toStringValue(getFromRow(normalisedRow, "A3. select the LGA")) || "Unknown LGA";
      const age = toNumberValue(getFromRow(normalisedRow, "A8. Age")) ?? undefined;
      const ageGroup = determineAgeGroup(age);
      const gender = normaliseGender(getFromRow(normalisedRow, "A7. Sex"));
      const deviceid = toStringValue(getFromRow(normalisedRow, "deviceid")) || undefined;
      const imei = toStringValue(getFromRow(normalisedRow, "imei")) || undefined;
      const subscriberid =
        toStringValue(getFromRow(normalisedRow, "subscriberid")) || undefined;
      const simserial = toStringValue(getFromRow(normalisedRow, "simserial")) || undefined;
      const respondentPhone =
        toStringValue(getFromRow(normalisedRow, "Respondent phone number")) || undefined;
      const approvalStatus = deriveApprovalStatus(normalisedRow);
      const interviewLength = (() => {
        const explicit = toNumberValue(
          getFromRow(normalisedRow, "Interview Length (mins)", "Interview Length", "LOI")
        );
        if (typeof explicit === "number") {
          return Math.max(Math.round(explicit), 0);
        }
        if (startDate && endDate) {
          const diff = Math.max(0, endDate.getTime() - startDate.getTime());
          return Math.round(diff / 60000);
        }
        return 0;
      })();
      const latitude = toNumberValue(
        getFromRow(normalisedRow, "_A5. GPS Coordinates_latitude")
      );
      const longitude = toNumberValue(
        getFromRow(normalisedRow, "_A5. GPS Coordinates_longitude")
      );
      const coordinatesText = toStringValue(
        getFromRow(normalisedRow, "A5. GPS Coordinates")
      );
      const parsedCoordinates =
        (latitude === undefined || longitude === undefined) && coordinatesText
          ? parseCoordinatePair(coordinatesText)
          : undefined;
      const resolvedLatitude = latitude ?? parsedCoordinates?.lat;
      const resolvedLongitude = longitude ?? parsedCoordinates?.lng;
      const errorFlags = parseErrorFlags(
        getFromRow(normalisedRow, "Error Flags", "Errors", "Error Flag")
      );
      const ogstepParticipation = normaliseOgstepParticipation(
        getFromRow(
          normalisedRow,
          "B2. Did you participate in OGSTEP?",
          "Did you participate in OGSTEP?"
        )
      );
      const qcStatusRaw = toStringValue(
        getFromRow(normalisedRow, "Outcome Status", "QC Status")
      );
      const submission: SheetSubmissionRow = {
        "Submission ID": submissionId,
        "Submission Date": submissionDateString,
        "Submission Time": submissionTimeString,
        start: startIso,
        end: endIso,
        starttime: startIso,
        endtime: endIso,
        "A1. Enumerator ID": enumeratorId,
        "Enumerator Name": enumeratorName,
        "Interviewer ID": enumeratorId,
        "Interviewer Name": enumeratorName,
        username,
        State: state,
        "A3. select the LGA": lga,
        LGA: lga,
        deviceid,
        imei,
        subscriberid,
        simserial,
        "Age Group": ageGroup,
        Gender: gender,
        "Approval Status": approvalStatus,
        "Error Flags": errorFlags,
        "Interview Length (mins)": interviewLength,
        Resp_No: respondentPhone,
        "Respondent phone number": respondentPhone,
        "A5. GPS Coordinates": coordinatesText || undefined,
        "_A5. GPS Coordinates_latitude": resolvedLatitude ?? 0,
        "_A5. GPS Coordinates_longitude": resolvedLongitude ?? 0,
      };
      if (ogstepParticipation) {
        submission["B2. Did you participate in OGSTEP?"] = ogstepParticipation;
      }
      let outcomeStatus: SheetSubmissionRow["Outcome Status"];
      if (qcStatusRaw) {
        const normalised = /^(pass|valid)$/i.test(qcStatusRaw)
          ? "Valid"
          : /^(fail|invalid)$/i.test(qcStatusRaw)
            ? "Invalid"
            : null;
        if (normalised) {
          outcomeStatus = normalised;
        }
      }
      if (!outcomeStatus) {
        outcomeStatus = approvalStatus === "Approved" ? "Valid" : "Invalid";
      }
      submission["Outcome Status"] = outcomeStatus;
      if (resolvedLatitude !== undefined) {
        submission.Latitude = resolvedLatitude;
      }
      if (resolvedLongitude !== undefined) {
        submission.Longitude = resolvedLongitude;
      }
      return submission;
    })
    .filter((row) => row["Submission ID"].length > 0);
};

export const mapSheetRowsToStateTargets = (
  rows: Record<string, unknown>[]
): SheetStateTargetRow[] =>
  rows
    .map((row) => {
      const normalisedRow = createNormalisedRow(row);
      const state = toStringValue(getFromRow(normalisedRow, "State", "State Name"));
      const target = toNumberValue(getFromRow(normalisedRow, "State Target", "Target"));
      if (!state || target === undefined) {
        return null;
      }
      return { State: state, "State Target": Math.round(target) };
    })
    .filter((entry): entry is SheetStateTargetRow => entry !== null);

export const mapSheetRowsToStateAgeTargets = (
  rows: Record<string, unknown>[]
): SheetStateAgeTargetRow[] =>
  rows
    .map((row) => {
      const normalisedRow = createNormalisedRow(row);
      const state = toStringValue(getFromRow(normalisedRow, "State", "State Name"));
      const ageGroup = normaliseAgeGroupLabel(
        toStringValue(getFromRow(normalisedRow, "Age Group", "Group", "Age"))
      );
      const target = toNumberValue(
        getFromRow(normalisedRow, "Age Group Target", "Target", "Age Target")
      );
      if (!state || !ageGroup || target === undefined) {
        return null;
      }
      return { State: state, "Age Group": ageGroup, "Age Group Target": Math.round(target) };
    })
    .filter((entry): entry is SheetStateAgeTargetRow => entry !== null);

export const mapSheetRowsToStateGenderTargets = (
  rows: Record<string, unknown>[]
): SheetStateGenderTargetRow[] =>
  rows
    .map((row) => {
      const normalisedRow = createNormalisedRow(row);
      const state = toStringValue(getFromRow(normalisedRow, "State", "State Name"));
      const gender = normaliseGender(getFromRow(normalisedRow, "Gender", "Group"));
      const target = toNumberValue(getFromRow(normalisedRow, "Gender Target", "Target"));
      if (!state || !gender || target === undefined) {
        return null;
      }
      return { State: state, Gender: gender, "Gender Target": Math.round(target) };
    })
    .filter((entry): entry is SheetStateGenderTargetRow => entry !== null);
