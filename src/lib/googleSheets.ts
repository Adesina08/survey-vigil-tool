import type {
  AgeGroup,
  ApprovalStatus,
  ErrorType,
  Gender,
  SheetStateAgeTargetRow,
  SheetStateGenderTargetRow,
  SheetStateTargetRow,
  SheetSubmissionRow,
} from "@/data/sampleData";

const GVIZ_PREFIX = "google.visualization.Query.setResponse(";
const GVIZ_SUFFIX = ");";
const GVIZ_SECURITY_PREFIX = ")]}'";

interface GVizColumn {
  id: string;
  label: string;
}

interface GVizCell {
  v?: unknown;
  f?: string;
}

interface GVizRow {
  c: GVizCell[];
}

interface GVizResponse {
  status: string;
  table: {
    cols: GVizColumn[];
    rows: GVizRow[];
  };
}

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

const createNormalisedRow = (row: Record<string, unknown>): NormalisedRow => {
  const map: NormalisedRow = new Map();

  Object.entries(row).forEach(([rawKey, value]) => {
    if (typeof rawKey !== "string" || rawKey.length === 0) {
      return;
    }

    const key = normaliseHeaderKey(rawKey);

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

const stripGVizSecurityPrefix = (rawText: string): string => {
  if (rawText.startsWith(GVIZ_SECURITY_PREFIX)) {
    return rawText.slice(GVIZ_SECURITY_PREFIX.length);
  }

  return rawText;
};

const parseGVizResponse = (rawText: string): Record<string, unknown>[] => {
  const trimmed = stripGVizSecurityPrefix(rawText.trim());

  if (!trimmed.startsWith(GVIZ_PREFIX) || !trimmed.endsWith(GVIZ_SUFFIX)) {
    throw new Error("Unexpected Google Sheets response format");
  }

  const jsonText = trimmed.slice(GVIZ_PREFIX.length, -GVIZ_SUFFIX.length);
  const parsed = JSON.parse(jsonText) as GVizResponse;

  if (parsed.status !== "ok") {
    throw new Error("Google Sheets request failed");
  }

  const headers = parsed.table.cols.map((column, index) => {
    const baseLabel = column.label?.trim() ?? column.id?.trim();
    return baseLabel && baseLabel.length > 0 ? baseLabel : `Column ${index + 1}`;
  });

  return parsed.table.rows.map((row) => {
    const record: Record<string, unknown> = {};

    row.c.forEach((cell, index) => {
      const header = headers[index] ?? `Column ${index + 1}`;
      record[header] = parseGVizCellValue(cell);
    });

    return record;
  });
};

const parseGVizCellValue = (cell?: GVizCell): unknown => {
  if (!cell || cell.v === null || cell.v === undefined) {
    return null;
  }

  const rawValue = cell.v;

  if (typeof rawValue === "string") {
    if (rawValue.startsWith("Date(") && rawValue.endsWith(")")) {
      const isoDate = convertGVizDate(rawValue);
      return isoDate ?? cell.f ?? null;
    }
    return rawValue;
  }

  if (typeof rawValue === "number" || typeof rawValue === "boolean") {
    return rawValue;
  }

  if (cell.f) {
    return cell.f;
  }

  return rawValue;
};

const convertGVizDate = (value: string): string | null => {
  const match = value.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
  if (!match) {
    return null;
  }

  const parts = match.slice(1).map((part) => Number.parseInt(part ?? "0", 10));
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0] = parts;

  const date = new Date(Date.UTC(year, month, day, hour, minute, second));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (inQuotes) {
      if (char === "\"") {
        const nextChar = line[index + 1];
        if (nextChar === "\"") {
          current += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};

const parseCsvResponse = (rawText: string): Record<string, unknown>[] => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      const value = values[index] ?? "";
      record[header] = value;
    });

    return record;
  });
};

const buildCsvFallbackUrl = (input: string): string => {
  const lower = input.toLowerCase();
  if (lower.includes("out:csv")) {
    return input;
  }

  if (lower.includes("out:json")) {
    return input.replace(/out:json/gi, "out:csv");
  }

  try {
    const url = new URL(input);
    const tqx = url.searchParams.get("tqx");

    if (tqx) {
      const parts = tqx
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      let replaced = false;
      const updatedParts = parts.map((part) => {
        const lowerPart = part.toLowerCase();
        if (lowerPart.startsWith("out:")) {
          replaced = true;
          return "out:csv";
        }
        return part;
      });

      if (!replaced) {
        updatedParts.push("out:csv");
      }

      url.searchParams.set("tqx", updatedParts.join(";"));
    } else {
      url.searchParams.set("tqx", "out:csv");
    }

    return url.toString();
  } catch (error) {
    console.warn("Failed to parse Google Sheets URL for CSV fallback", error);
    const separator = input.includes("?") ? "&" : "?";
    return `${input}${separator}tqx=out:csv`;
  }
};

export async function fetchGoogleSheetFromUrl(
  fullUrl: string
): Promise<Record<string, unknown>[]> {
  const trimmedUrl = fullUrl.trim();
  if (!trimmedUrl) {
    throw new Error("Google Sheets URL is empty");
  }

  const response = await fetch(trimmedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet: ${response.status} ${response.statusText}`);
  }

  const rawText = await response.text();

  try {
    return parseGVizResponse(rawText);
  } catch (error) {
    console.warn("Failed to parse GViz response, attempting CSV fallback", error);
  }

  const csvUrl = buildCsvFallbackUrl(trimmedUrl);
  const csvResponse = await fetch(csvUrl);
  if (!csvResponse.ok) {
    throw new Error(`Failed to fetch Google Sheet CSV: ${csvResponse.status} ${csvResponse.statusText}`);
  }

  const csvText = await csvResponse.text();
  const rows = parseCsvResponse(csvText);
  if (rows.length === 0) {
    throw new Error("Google Sheet CSV returned no rows");
  }

  return rows;
}

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

      const approvalRaw = toStringValue(
        getFromRow(normalisedRow, "A6. Consent to participate")
      ).toLowerCase();
      const approvalStatus: ApprovalStatus =
        approvalRaw.includes("not") ||
        approvalRaw === "no" ||
        approvalRaw === "0" ||
        approvalRaw === "false"
          ? "Not Approved"
          : "Approved";

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
